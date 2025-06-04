/*
 * This file is part of FFmpeg.
 *
 * FFmpeg is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * FFmpeg is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with FFmpeg; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA
 */

/**
 * @file
 * drawvg filter, draw vector graphics with cairo.
 */

#include <cairo.h>

#include "libavutil/avassert.h"
#include "libavutil/avstring.h"
#include "libavutil/bswap.h"
#include "libavutil/eval.h"
#include "libavutil/internal.h"
#include "libavutil/macros.h"
#include "libavutil/mem.h"
#include "libavutil/opt.h"
#include "libavutil/pixdesc.h"
#include "libavutil/sfc64.h"

#include "avfilter.h"
#include "filters.h"
#include "textutils.h"
#include "video.h"

// Variables to evaluate expressions.

enum {
    VAR_N,          ///< Frame number.
    VAR_T,          ///< Timestamp in seconds.
    VAR_W,          ///< Frame width.
    VAR_H,          ///< Frame height.
    VAR_DURATION,   ///< Frame duration.
    VAR_CX,         ///< X coordinate for current point.
    VAR_CY,         ///< Y coordinate for current point.
    VAR_I,          ///< Loop counter, to use with `repeat {}`.
    VAR_U0,         ///< User variables.
};

/// Number of user variables that can be created with `setvar`.
///
/// It is possible to allow any number of variables, but this
/// approach simplifies the implementation, and 10 variables
/// is more than enough for the expected use of this filter.
#define USER_VAR_COUNT 10

// Total number of variables (default- and user-variables).
#define VAR_COUNT (VAR_U0 + USER_VAR_COUNT)

static const char *const vgs_default_vars[] = {
    "n",
    "t",
    "w",
    "h",
    "duration",
    "cx",
    "cy",
    "i",
    NULL, // User variables. Name is assigned by `setvar`.
};

// Functions used in expressions.

static const char *const vgs_func1_names[] = {
    "getvar",
    "pathlen",
    "randomg",
    NULL,
};

static double vgs_fn_getvar(void*, double);
static double vgs_fn_pathlen(void*, double);
static double vgs_fn_randomg(void*, double);

static double (*const vgs_func1_impls[])(void *, double) = {
    vgs_fn_getvar,
    vgs_fn_pathlen,
    vgs_fn_randomg,
    NULL,
};


// Instructions.

enum VGSInstruction {
    INS_ARC = 1,                ///<  arc (cx cy radius angle1 angle2)
    INS_ARC_NEG,                ///<  arcn (cx cy radius angle1 angle2)
    INS_BREAK,                  ///<  break
    INS_CIRCLE,                 ///<  circle (cx cy radius)
    INS_CLIP,                   ///<  clip
    INS_CLIP_EO,                ///<  eoclip
    INS_CLOSE_PATH,             ///<  Z, z, closepath
    INS_COLOR_STOP,             ///<  colorstop (offset color)
    INS_CURVE_TO,               ///<  C, curveto (x1 y1 x2 y2 x y)
    INS_DEF_HSLA,               ///<  defhsla (varname h s l a)
    INS_DEF_RGBA,               ///<  defrgba (varname r g b a)
    INS_CURVE_TO_REL,           ///<  c, rcurveto (dx1 dy1 dx2 dy2 dx dy)
    INS_ELLIPSE,                ///<  ellipse (cx cy rx ry)
    INS_FILL,                   ///<  fill
    INS_FILL_EO,                ///<  eofill
    INS_GET_METADATA,           ///<  getmetadata varname key
    INS_HORZ,                   ///<  H (x)
    INS_HORZ_REL,               ///<  h (dx)
    INS_IF,                     ///<  if (condition) { subprogram }
    INS_LINEAR_GRAD,            ///<  lineargrad (x0 y0 x1 y1)
    INS_LINE_TO,                ///<  L, lineto (x y)
    INS_LINE_TO_REL,            ///<  l, rlineto (dx dy)
    INS_MOVE_TO,                ///<  M, moveto (x y)
    INS_MOVE_TO_REL,            ///<  m, rmoveto (dx dy)
    INS_NEW_PATH,               ///<  newpath
    INS_PRESERVE,               ///<  preserve
    INS_PRINT,                  ///<  print (expr)
    INS_PROC1_ASSIGN,           ///<  proc1 name varname { subprogram }
    INS_PROC1_CALL,             ///<  call1 name (arg)
    INS_PROC2_ASSIGN,           ///<  proc2 name varname1 varname2 { subprogram }
    INS_PROC2_CALL,             ///<  call2 name (arg1 arg2)
    INS_PROC_ASSIGN,            ///<  proc name { subprogram }
    INS_PROC_CALL,              ///<  call name
    INS_Q_CURVE_TO,             ///<  Q (x1 y1 x y)
    INS_Q_CURVE_TO_REL,         ///<  q (dx1 dy1 dx dy)
    INS_RADIAL_GRAD,            ///<  radialgrad (cx0 cy0 radius0 cx1 cy1 radius1)
    INS_RECT,                   ///<  rect (x y width height)
    INS_REPEAT,                 ///<  repeat (count) { subprogram }
    INS_RESET_CLIP,             ///<  resetclip
    INS_RESET_DASH,             ///<  resetdash
    INS_RESTORE,                ///<  restore
    INS_ROTATE,                 ///<  rotate (angle)
    INS_ROUNDEDRECT,            ///<  roundedrect (x y width height radius)
    INS_SAVE,                   ///<  save
    INS_SCALE,                  ///<  scale (s)
    INS_SCALEXY,                ///<  scalexy (sx sy)
    INS_SET_COLOR,              ///<  setcolor (color)
    INS_SET_DASH,               ///<  setdash (length)
    INS_SET_DASH_OFFSET,        ///<  setdashoffset (offset)
    INS_SET_HSLA,               ///<  sethsla (h s l a)
    INS_SET_LINE_CAP,           ///<  setlinecap (cap)
    INS_SET_LINE_JOIN,          ///<  setlinejoin (join)
    INS_SET_LINE_WIDTH,         ///<  setlinewidth (width)
    INS_SET_RGBA,               ///<  setrgba (r g b a)
    INS_SET_VAR,                ///<  setvar (varname value)
    INS_STROKE,                 ///<  stroke
    INS_S_CURVE_TO,             ///<  S (x2 y2 x y)
    INS_S_CURVE_TO_REL,         ///<  s (dx2 dy2 dx dy)
    INS_TRANSLATE,              ///<  translate (tx ty)
    INS_T_CURVE_TO,             ///<  T (x y)
    INS_T_CURVE_TO_REL,         ///<  t (dx dy)
    INS_VERT,                   ///<  V (y)
    INS_VERT_REL,               ///<  v (dy)
};

// Constants used in some draw instructions, like `setlinejoin`.
struct VGSConstant {
    const char* name;
    int value;
};

static struct VGSConstant vgs_consts_line_cap[] = {
    { "butt", CAIRO_LINE_CAP_BUTT },
    { "round", CAIRO_LINE_CAP_ROUND },
    { "square", CAIRO_LINE_CAP_SQUARE },
    { NULL, 0 },
};

static struct VGSConstant vgs_consts_line_join[] = {
    { "bevel", CAIRO_LINE_JOIN_BEVEL },
    { "miter", CAIRO_LINE_JOIN_MITER },
    { "round", CAIRO_LINE_JOIN_ROUND },
    { NULL, 0 },
};

// Instruction parameters.
struct VGSParameter {
    enum {
        PARAM_COLOR = 1,
        PARAM_CONSTANT,
        PARAM_END,
        PARAM_MAY_REPEAT,
        PARAM_NUMERIC,
        PARAM_NUMERIC_METADATA,
        PARAM_PROC_NAME,
        PARAM_RAW_IDENT,
        PARAM_SUBPROGRAM,
        PARAM_VARIADIC,
        PARAM_VAR_NAME,
    } type;

    const struct VGSConstant *constants;
};

#define MAX_INSTRUCTION_PARAMS 8

// Instruction declarations.

struct VGSInstructionDecl {
    enum VGSInstruction inst;
    const char* name;
    const struct VGSParameter params[MAX_INSTRUCTION_PARAMS];
};

#define L(...) { __VA_ARGS__, { PARAM_END } }            // Parameter list
#define R(...) { __VA_ARGS__, { PARAM_MAY_REPEAT } }     // Repeatable PL
#define NONE { { PARAM_END } }
#define N { PARAM_NUMERIC }
#define V { PARAM_VAR_NAME }
#define P { PARAM_SUBPROGRAM }
#define C(c) { PARAM_CONSTANT, .constants = c }

// Instructions available to the scripts.
//
// The array must be sorted in ascending order by `name`.
struct VGSInstructionDecl vgs_instructions[] = {
    { INS_CURVE_TO,         "C",              R(N, N, N, N, N, N) },
    { INS_HORZ,             "H",              R(N) },
    { INS_LINE_TO,          "L",              R(N, N) },
    { INS_MOVE_TO,          "M",              R(N, N) },
    { INS_Q_CURVE_TO,       "Q",              R(N, N, N, N) },
    { INS_S_CURVE_TO,       "S",              R(N, N, N, N) },
    { INS_T_CURVE_TO,       "T",              R(N, N) },
    { INS_VERT,             "V",              R(N) },
    { INS_CLOSE_PATH,       "Z",              NONE },
    { INS_ARC,              "arc",            R(N, N, N, N, N) },
    { INS_ARC_NEG,          "arcn",           R(N, N, N, N, N) },
    { INS_BREAK,            "break",          NONE },
    { INS_CURVE_TO_REL,     "c",              R(N, N, N, N, N, N) },
    { INS_PROC_CALL,        "call",           L({ PARAM_PROC_NAME }) },
    { INS_PROC1_CALL,       "call1",          L({ PARAM_PROC_NAME }, N) },
    { INS_PROC2_CALL,       "call2",          L({ PARAM_PROC_NAME }, N, N) },
    { INS_CIRCLE,           "circle",         R(N, N, N) },
    { INS_CLIP,             "clip",           NONE },
    { INS_CLOSE_PATH,       "closepath",      NONE },
    { INS_COLOR_STOP,       "colorstop",      R(N, { PARAM_COLOR }) },
    { INS_CURVE_TO,         "curveto",        R(N, N, N, N, N, N) },
    { INS_DEF_HSLA,         "defhsla",        L(V, N, N, N, N) },
    { INS_DEF_RGBA,         "defrgba",        L(V, N, N, N, N) },
    { INS_ELLIPSE,          "ellipse",        R(N, N, N, N) },
    { INS_CLIP_EO,          "eoclip",         NONE },
    { INS_FILL_EO,          "eofill",         NONE },
    { INS_FILL,             "fill",           NONE },
    { INS_GET_METADATA,     "getmetadata",    L(V, { PARAM_RAW_IDENT }) },
    { INS_HORZ_REL,         "h",              R(N) },
    { INS_IF,               "if",             L(N, P) },
    { INS_LINE_TO_REL,      "l",              R(N, N) },
    { INS_LINEAR_GRAD,      "lineargrad",     L(N, N, N, N) },
    { INS_LINE_TO,          "lineto",         R(N, N) },
    { INS_MOVE_TO_REL,      "m",              R(N, N) },
    { INS_MOVE_TO,          "moveto",         R(N, N) },
    { INS_NEW_PATH,         "newpath",        NONE },
    { INS_PRESERVE,         "preserve",       NONE },
    { INS_PRINT,            "print",          { { PARAM_NUMERIC_METADATA }, { PARAM_VARIADIC } } },
    { INS_PROC_ASSIGN,      "proc",           L({ PARAM_PROC_NAME }, P) },
    { INS_PROC1_ASSIGN,     "proc1",          L({ PARAM_PROC_NAME }, V, P) },
    { INS_PROC2_ASSIGN,     "proc2",          L({ PARAM_PROC_NAME }, V, V, P) },
    { INS_Q_CURVE_TO_REL,   "q",              R(N, N, N, N) },
    { INS_RADIAL_GRAD,      "radialgrad",     L(N, N, N, N, N, N) },
    { INS_CURVE_TO_REL,     "rcurveto",       R(N, N, N, N, N, N) },
    { INS_RECT,             "rect",           R(N, N, N, N) },
    { INS_REPEAT,           "repeat",         L(N, P) },
    { INS_RESET_CLIP,       "resetclip",      NONE },
    { INS_RESET_DASH,       "resetdash",      NONE },
    { INS_RESTORE,          "restore",        NONE },
    { INS_LINE_TO_REL,      "rlineto",        R(N, N) },
    { INS_MOVE_TO_REL,      "rmoveto",        R(N, N) },
    { INS_ROTATE,           "rotate",         L(N) },
    { INS_ROUNDEDRECT,      "roundedrect",    R(N, N, N, N, N) },
    { INS_S_CURVE_TO_REL,   "s",              R(N, N, N, N) },
    { INS_SAVE,             "save",           NONE },
    { INS_SCALE,            "scale",          L(N) },
    { INS_SCALEXY,          "scalexy",        L(N, N) },
    { INS_SET_COLOR,        "setcolor",       L({ PARAM_COLOR }) },
    { INS_SET_DASH,         "setdash",        R(N) },
    { INS_SET_DASH_OFFSET,  "setdashoffset",  R(N) },
    { INS_SET_HSLA,         "sethsla",        L(N, N, N, N) },
    { INS_SET_LINE_CAP,     "setlinecap",     L(C(vgs_consts_line_cap)) },
    { INS_SET_LINE_JOIN,    "setlinejoin",    L(C(vgs_consts_line_join)) },
    { INS_SET_LINE_WIDTH,   "setlinewidth",   L(N) },
    { INS_SET_RGBA,         "setrgba",        L(N, N, N, N) },
    { INS_SET_VAR,          "setvar",         L(V, N) },
    { INS_STROKE,           "stroke",         NONE },
    { INS_T_CURVE_TO_REL,   "t",              R(N, N) },
    { INS_TRANSLATE,        "translate",      L(N, N) },
    { INS_VERT_REL,         "v",              R(N) },
    { INS_CLOSE_PATH,       "z",              NONE },
};

#undef L
#undef R
#undef NONE
#undef N
#undef C

// Comparator for `ScriptInstructionSpec`, to be used with `bsearch(3)`.
static int vgs_comp_instruction_spec(const void *cs1, const void *cs2) {
    return strcmp(
        ((struct VGSInstructionDecl*)cs1)->name,
        ((struct VGSInstructionDecl*)cs2)->name
    );
}

// Return the specs for the given instruction, or `NULL` if the name is not valid.
static const struct VGSInstructionDecl* vgs_get_instruction(const char *name, size_t length) {
    char bufname[64];
    struct VGSInstructionDecl key = { .name = bufname };

    if (length >= sizeof(bufname)) {
        return NULL;
    }

    memcpy(bufname, name, length);
    bufname[length] = '\0';

    return bsearch(
        &key,
        vgs_instructions,
        FF_ARRAY_ELEMS(vgs_instructions),
        sizeof(vgs_instructions[0]),
        vgs_comp_instruction_spec
    );
}

static int vgs_proc_num_args(enum VGSInstruction inst) {
    switch (inst) {
    case INS_PROC_CALL:
    case INS_PROC_ASSIGN:
        return 0;

    case INS_PROC1_CALL:
    case INS_PROC1_ASSIGN:
        return 1;

    case INS_PROC2_CALL:
    case INS_PROC2_ASSIGN:
        return 2;

    default:
        av_assert0(0);
    }
}

/// Return `1` if the instruction changes the path.
static int vgs_inst_change_path(enum VGSInstruction inst) {
    switch (inst) {
    case INS_BREAK:
    case INS_COLOR_STOP:
    case INS_DEF_HSLA:
    case INS_DEF_RGBA:
    case INS_GET_METADATA:
    case INS_IF:
    case INS_LINEAR_GRAD:
    case INS_PRINT:
    case INS_PROC1_ASSIGN:
    case INS_PROC1_CALL:
    case INS_PROC2_ASSIGN:
    case INS_PROC2_CALL:
    case INS_PROC_ASSIGN:
    case INS_PROC_CALL:
    case INS_RADIAL_GRAD:
    case INS_REPEAT:
    case INS_RESET_DASH:
    case INS_SET_COLOR:
    case INS_SET_DASH:
    case INS_SET_DASH_OFFSET:
    case INS_SET_HSLA:
    case INS_SET_LINE_CAP:
    case INS_SET_LINE_JOIN:
    case INS_SET_LINE_WIDTH:
    case INS_SET_RGBA:
    case INS_SET_VAR:
        return 0;

    default:
        return 1;
    }
}

// Parser.

struct VGSParser {
    const char* source;
    size_t cursor;

    const char **proc_names;
    int proc_names_count;

    // Store the variable names for the default ones
    // (from `vgs_default_vars`) and the variables
    // created with `setvar`.
    //
    // The extra slot is needed to store the `NULL`
    // terminator expected by `av_expr_parse`.
    const char *var_names[VAR_COUNT + 1];
};

struct VGSParserToken {
    enum {
        TOKEN_EOF = 1,
        TOKEN_EXPR,
        TOKEN_LEFT_BRACKET,
        TOKEN_LITERAL,
        TOKEN_RIGHT_BRACKET,
        TOKEN_WORD,
    } type;

    const char *lexeme;
    size_t position;
    size_t length;
};

// Return `1` if `token` is the value of `str`.
static int vgs_token_is_string(const struct VGSParserToken *token, const char *str) {
    return strncmp(str, token->lexeme, token->length) == 0
        && str[token->length] == '\0';
}

static void vgs_token_span(
    const struct VGSParser *parser,
    const struct VGSParserToken *token,
    size_t *line,
    size_t *column
) {
    const char *source = parser->source;

    *line = 1;

    for (;;) {
        const char *sep = strchr(source, '\n');

        if (sep == NULL || (sep - parser->source) > token->position) {
            *column = token->position - (source - parser->source) + 1;
            break;
        }

        ++*line;
        source = sep + 1;
    }
}

static av_printf_format(4, 5)
void vgs_log_invalid_token(
    void *log_ctx,
    const struct VGSParser *parser,
    const struct VGSParserToken *token,
    const char *extra_fmt,
    ...
) {
    va_list ap;
    char extra[256];
    size_t line, column;

    vgs_token_span(parser, token, &line, &column);

    // Format extra message.
    va_start(ap, extra_fmt);
    vsnprintf(extra, sizeof(extra), extra_fmt, ap);
    va_end(ap);

    av_log(log_ctx, AV_LOG_ERROR,
        "Invalid token '%.*s' at line %zu, column %zu: %s\n",
        (int)token->length, token->lexeme, line, column, extra);
}

// Return the next token in the source.
//
// @param[out]  token     Next token.
// @param[in]   advance   If true, the parser cursor is updated after
//                        the returned token.
//
// @return `0` on success, a negative `AVERROR` code on failure.
static int vgs_parser_next_token(
    void *log_ctx,
    struct VGSParser *parser,
    struct VGSParserToken *token,
    int advance
) {

#define WORD_SEPARATOR " \n\t\r,"

    int level;
    size_t cursor, length;
    const char *source;

next_token:

    source = &parser->source[parser->cursor];

    cursor = strspn(source, WORD_SEPARATOR);
    token->position = parser->cursor + cursor;
    token->lexeme = &source[cursor];

    switch (source[cursor]) {
    case '\0':
        token->type = TOKEN_EOF;
        token->lexeme = "<EOF>";
        token->length = 5;
        return 0;

    case '(':
        // Find matching parenthesis.
        level = 1;
        length = 1;

        while (level > 0) {
            switch (source[cursor + length]) {
            case '\0':
                token->length = 1; // Show only the '(' in the error message.
                vgs_log_invalid_token(log_ctx, parser, token, "Unmatched parenthesis.");
                return AVERROR(EINVAL);

            case '(':
                level++;
                break;

            case ')':
                level--;
                break;
            }

            length++;
        }

        token->type = TOKEN_EXPR;
        token->length = length;
        break;

    case '{':
        token->type = TOKEN_LEFT_BRACKET;
        token->length = 1;
        break;

    case '}':
        token->type = TOKEN_RIGHT_BRACKET;
        token->length = 1;
        break;

    case '+':
    case '-':
    case '.':
    case '0':
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
        token->type = TOKEN_LITERAL;
        token->length = strcspn(token->lexeme, WORD_SEPARATOR);
        break;

    case '/':
        // If the next character is also '/', ignore the rest of
        // the line.
        //
        // If it is something else, return a `TOKEN_WORD`.
        if (source[cursor + 1] == '/') {
            parser->cursor += cursor + strcspn(token->lexeme, "\n");
            goto next_token;
        }

        /* fallthrough */

    default:
        token->type = TOKEN_WORD;
        token->length = strcspn(token->lexeme, WORD_SEPARATOR);
        break;
    }

    if (advance) {
        parser->cursor += cursor + token->length;
    }

    return 0;
}

// Instruction arguments.
struct VGSArgument {
    enum {
        ARG_COLOR = 1,
        ARG_COLOR_VAR,
        ARG_CONST,
        ARG_EXPR,
        ARG_LITERAL,
        ARG_METADATA,
        ARG_PROCEDURE_ID,
        ARG_SUBPROGRAM,
        ARG_VARIABLE,
    } type;

    union {
        uint8_t color[4];
        int constant;
        AVExpr *expr;
        double literal;
        int proc_id;
        struct VGSProgram *subprogram;
        int variable;
    };

    char *metadata;
};

// Program statements.
struct VGSStatement {
    enum VGSInstruction inst;
    struct VGSArgument *args;
    int args_count;
};

struct VGSProgram {
    struct VGSStatement *statements;
    int statements_count;

    const char **proc_names;
    int proc_names_count;
};

static void vgs_free(struct VGSProgram *program);

static int vgs_parse(
    void *log_ctx,
    struct VGSParser *parser,
    struct VGSProgram *program,
    int subprogram
);

static void vgs_statement_free(struct VGSStatement *stm) {
    if (stm->args == NULL)
        return;

    for (int j = 0; j < stm->args_count; j++) {
        struct VGSArgument *arg = &stm->args[j];

        switch (arg->type) {
        case ARG_EXPR:
            av_expr_free(arg->expr);
            break;

        case ARG_SUBPROGRAM:
            vgs_free(arg->subprogram);
            av_freep(&arg->subprogram);
            break;
        }

        if (arg->metadata)
            av_freep(&arg->metadata);
    }

    av_freep(&stm->args);
}

// Release the memory allocated by the program.
static void vgs_free(struct VGSProgram *program) {
    if (program->statements == NULL)
        return;

    for (int i = 0; i < program->statements_count; i++)
        vgs_statement_free(&program->statements[i]);

    av_freep(&program->statements);

    if (program->proc_names != NULL) {
        for (int i = 0; i < program->proc_names_count; i++)
            av_freep(&program->proc_names[i]);

        av_freep(&program->proc_names);
    }
}

static int vgs_parse_numeric_argument(
    void *log_ctx,
    struct VGSParser *parser,
    struct VGSArgument *arg,
    int metadata
) {
    int ret;
    char stack_buf[64];
    char *lexeme, *endp;
    struct VGSParserToken token;

    ret = vgs_parser_next_token(log_ctx, parser, &token, 1);
    if (ret != 0)
        return ret;

    // Convert the lexeme to a NUL-terminated string.
    if (token.length + 1 < sizeof(stack_buf)) {
        lexeme = stack_buf;
    } else {
        lexeme = av_malloc(token.length + 1);
    }

    memcpy(lexeme, token.lexeme, token.length);
    lexeme[token.length] = '\0';

    switch (token.type) {
    case TOKEN_LITERAL:
        arg->type = ARG_LITERAL;
        arg->literal = av_strtod(lexeme, &endp);

        if (*endp != '\0') {
            vgs_log_invalid_token(log_ctx, parser, &token, "Expected valid number.");
            ret = AVERROR(EINVAL);
        }
        break;

    case TOKEN_EXPR:
        arg->type = ARG_EXPR;
        ret = av_expr_parse(
            &arg->expr,
            lexeme,
            parser->var_names,
            vgs_func1_names,
            vgs_func1_impls,
            NULL,
            NULL,
            0,
            log_ctx
        );

        if (ret != 0)
            vgs_log_invalid_token(log_ctx, parser, &token, "Invalid expression.");

        break;

    case TOKEN_WORD:
        ret = 1;
        for (int i = 0; i < VAR_COUNT; i++) {
            const char *var = parser->var_names[i];
            if (var == NULL)
                break;

            if (vgs_token_is_string(&token, var)) {
                arg->type = ARG_VARIABLE;
                arg->variable = i;
                ret = 0;
                break;
            }
        }

        if (ret == 0)
            break;

        /* fallthrough */

    default:
        vgs_log_invalid_token(log_ctx, parser, &token, "Expected numeric argument.");
        ret = AVERROR(EINVAL);
    }

    if (ret == 0) {
        if (metadata) {
            size_t line, column;
            vgs_token_span(parser, &token, &line, &column);
            arg->metadata = av_asprintf("[%zu:%zu] %s", line, column, lexeme);
        } else {
            arg->metadata = NULL;
        }
    } else {
        memset(arg, 0, sizeof(*arg));
    }

    if (lexeme != stack_buf)
        av_freep(&lexeme);

    return ret;
}

// Check if the next token repeats the current instruction,
// like in `l 10 10 20 20`.
static int vgs_parser_can_repeat_inst(void *log_ctx, struct VGSParser *parser) {
    struct VGSParserToken token = { 0 };

    int ret = vgs_parser_next_token(log_ctx, parser, &token, 0);

    if (ret != 0)
        return ret;

    switch (token.type) {
    case TOKEN_EXPR:
    case TOKEN_LITERAL:
        return 0;

    case TOKEN_WORD:
        // If the next token is a word, it will be considered to repeat
        // the instruction only if it is a variable, and there is not
        // known instruction with the same name.

        if (vgs_get_instruction(token.lexeme, token.length) != NULL)
            return 1;

        for (int i = 0; i < VAR_COUNT; i++) {
            const char *var = parser->var_names[i];
            if (var == NULL)
                return 1;

            if (vgs_token_is_string(&token, var))
                return 0;
        }

        return 1;

    default:
        return 1;
    }
}


static int vgs_is_valid_identifier(const struct VGSParserToken *token) {
    // An identifier is valid if:
    //
    //  - It starts with an alphabetic character or an underscore.
    //  - Everything else, alphanumeric or underscore

    for (int i = 0; i < token->length; i++) {
        char c = token->lexeme[i];
        if (c != '_'
            && !(c >= 'a' && c <= 'z')
            && !(c >= 'A' && c <= 'Z')
            && !(i > 0 && c >= '0' && c <= '9')
        ) {
            return 0;
        }
    }

    return 1;
}

// Extract the arguments for an instruction, and add a new statement
// to the program.
//
// On success, return `0`.
static int vgs_parse_statement(
    void *log_ctx,
    struct VGSParser *parser,
    struct VGSProgram *program,
    const struct VGSInstructionDecl *decl
) {

#define FAIL(err) \
    do {                                \
        vgs_statement_free(&statement); \
        return AVERROR(err);            \
    } while(0)


    struct VGSStatement statement = {
        .inst = decl->inst,
        .args = NULL,
        .args_count = 0,
    };

    const struct VGSParameter *param = &decl->params[0];

    for (;;) {
        int ret;
        void *r;

        struct VGSParserToken token = { 0 };
        struct VGSArgument arg = { 0 };

        switch (param->type) {
        case PARAM_VARIADIC:
            // Try to append the next numeric argument to the current
            // statement.
            if (statement.args_count < MAX_INSTRUCTION_PARAMS
                && vgs_parser_can_repeat_inst(log_ctx, parser) == 0
            ) {
                param = &decl->params[0];
                continue;
            }

            /* fallthrough */

        case PARAM_END:
        case PARAM_MAY_REPEAT:
            // Add the built statement to the program.
            r = av_dynarray2_add(
                (void*)&program->statements,
                &program->statements_count,
                sizeof(statement),
                (void*)&statement
            );

            if (r == NULL)
                FAIL(ENOMEM);

            // May repeat if the next token is numeric.
            if (param->type != PARAM_END
                && vgs_parser_can_repeat_inst(log_ctx, parser) == 0
            ) {
                param = &decl->params[0];
                statement.args = NULL;
                statement.args_count = 0;
                continue;
            }

            return 0;

        case PARAM_COLOR:
            ret = vgs_parser_next_token(log_ctx, parser, &token, 1);
            if (ret != 0)
                FAIL(EINVAL);

            arg.type = ARG_COLOR;

            for (int i = VAR_U0; i < VAR_COUNT; i++) {
                if (parser->var_names[i] == NULL)
                    break;

                if (vgs_token_is_string(&token, parser->var_names[i])) {
                    arg.type = ARG_COLOR_VAR;
                    arg.variable = i;
                    break;
                }
            }

            if (arg.type == ARG_COLOR_VAR)
                break;

            ret = av_parse_color(arg.color, token.lexeme, token.length, log_ctx);
            if (ret != 0) {
                vgs_log_invalid_token(log_ctx, parser, &token, "Expected color.");
                FAIL(EINVAL);
            }

            break;

        case PARAM_CONSTANT: {
            int found = 0;
            char expected_names[64] = { 0 };

            ret = vgs_parser_next_token(log_ctx, parser, &token, 1);
            if (ret != 0)
                FAIL(EINVAL);

            for (
                const struct VGSConstant *constant = param->constants;
                constant->name != NULL;
                constant++
            ) {
                if (vgs_token_is_string(&token, constant->name)) {
                    arg.type = ARG_CONST;
                    arg.constant = constant->value;

                    found = 1;
                    break;
                }

                // Collect valid names to include them in the error message, in case
                // the name is not found.
                av_strlcatf(expected_names, sizeof(expected_names), " '%s'", constant->name);
            }

            if (!found) {
                vgs_log_invalid_token(log_ctx, parser, &token, "Expected one of%s.", expected_names);
                FAIL(EINVAL);
            }

            break;
        }

        case PARAM_NUMERIC:
        case PARAM_NUMERIC_METADATA:
            ret = vgs_parse_numeric_argument(
                log_ctx,
                parser,
                &arg,
                param->type == PARAM_NUMERIC_METADATA
            );

            if (ret != 0)
                FAIL(EINVAL);

            break;

        case PARAM_PROC_NAME: {
            int proc_id;

            ret = vgs_parser_next_token(log_ctx, parser, &token, 1);
            if (ret != 0)
                FAIL(EINVAL);

            if (!vgs_is_valid_identifier(&token)) {
                vgs_log_invalid_token(log_ctx, parser, &token, "Invalid procedure name.");
                FAIL(EINVAL);
            }

            // Use the index in the array as the identifier of the name.

            for (proc_id = 0; proc_id < parser->proc_names_count; proc_id++) {
                if (vgs_token_is_string(&token, parser->proc_names[proc_id]))
                    break;
            }

            if (proc_id == parser->proc_names_count) {
                const char *name = av_strndup(token.lexeme, token.length);

                const char **r = av_dynarray2_add(
                    (void*)&parser->proc_names,
                    &parser->proc_names_count,
                    sizeof(name),
                    (void*)&name
                );

                if (r == NULL) {
                    av_freep(&name);
                    FAIL(ENOMEM);
                }
            }

            arg.type = ARG_PROCEDURE_ID;
            arg.proc_id = proc_id;

            break;
        }


        case PARAM_RAW_IDENT:
            ret = vgs_parser_next_token(log_ctx, parser, &token, 1);
            if (ret != 0)
                FAIL(EINVAL);

            switch (token.type) {
            case TOKEN_LITERAL:
            case TOKEN_WORD:
                arg.type = ARG_METADATA;
                arg.metadata = av_strndup(token.lexeme, token.length);
                break;

            default:
                vgs_log_invalid_token(log_ctx, parser, &token, "Expected '{'.");
                FAIL(EINVAL);
            }

            break;

        case PARAM_SUBPROGRAM:
            ret = vgs_parser_next_token(log_ctx, parser, &token, 1);
            if (ret != 0)
                FAIL(EINVAL);

            if (token.type != TOKEN_LEFT_BRACKET) {
                vgs_log_invalid_token(log_ctx, parser, &token, "Expected '{'.");
                FAIL(EINVAL);
            }

            arg.type = ARG_SUBPROGRAM;
            arg.subprogram = av_mallocz(sizeof(struct VGSProgram));

            ret = vgs_parse(log_ctx, parser, arg.subprogram, 1);
            if (ret != 0) {
                av_freep(&arg.subprogram);
                FAIL(EINVAL);
            }

            break;

        case PARAM_VAR_NAME: {
            int var_idx = -1;

            ret = vgs_parser_next_token(log_ctx, parser, &token, 1);
            if (ret != 0)
                FAIL(EINVAL);

            // Find the slot where the variable is allocated, or the next
            // available slot if it is a new variable.
            for (int i = 0; i < VAR_COUNT; i++) {
                if (parser->var_names[i] == NULL
                    || vgs_token_is_string(&token, parser->var_names[i])
                ) {
                    var_idx = i;
                    break;
                }
            }

            // No free slots to allocate new variables.
            if (var_idx == -1) {
                vgs_log_invalid_token(log_ctx, parser, &token,
                    "Too many user variables. Can define up to %d variables.", USER_VAR_COUNT);
                FAIL(E2BIG);
            }

            // If the index is before `VAR_U0`, the name is already taken by
            // a default variable.
            if (var_idx < VAR_U0) {
                vgs_log_invalid_token(log_ctx, parser, &token, "Reserved variable name.");
                FAIL(EINVAL);
            }

            // Need to allocate a new variable.
            if (parser->var_names[var_idx] == NULL) {
                if (!vgs_is_valid_identifier(&token)) {
                    vgs_log_invalid_token(log_ctx, parser, &token, "Invalid variable name.");
                    FAIL(EINVAL);
                }

                parser->var_names[var_idx] = av_strndup(token.lexeme, token.length);
            }

            arg.type = ARG_CONST;
            arg.constant = var_idx;
            break;
        }

        default:
            av_assert0(0); /* unreachable */
        }

        r = av_dynarray2_add(
            (void*)&statement.args,
            &statement.args_count,
            sizeof(arg),
            (void*)&arg
        );

        if (r == NULL)
            FAIL(ENOMEM);

        param++;
    }

#undef FAIL
}

static void vgs_parser_init(struct VGSParser *parser, const char *source) {
    parser->source = source;
    parser->cursor = 0;

    parser->proc_names = NULL;
    parser->proc_names_count = 0;

    memset(parser->var_names, 0, sizeof(parser->var_names));
    for (int i = 0; i < VAR_U0; i++)
        parser->var_names[i] = vgs_default_vars[i];
}

static void vgs_parser_free(struct VGSParser *parser) {
    for (int i = VAR_U0; i < VAR_COUNT; i++)
        if (parser->var_names[i] != NULL)
            av_freep(&parser->var_names[i]);

    if (parser->proc_names != NULL) {
        for (int i = 0; i < parser->proc_names_count; i++)
            av_freep(&parser->proc_names[i]);

        av_freep(&parser->proc_names);
    }
}

// Parse a script to generate the program statements.
//
// @return `0` on success, a negative `AVERROR` code on failure.
static int vgs_parse(
    void *log_ctx,
    struct VGSParser *parser,
    struct VGSProgram *program,
    int subprogram
) {
    struct VGSParserToken token;

    program->statements = NULL;
    program->statements_count = 0;

    program->proc_names = NULL;
    program->proc_names_count = 0;

    for (;;) {
        int ret;
        const struct VGSInstructionDecl *inst;

        ret = vgs_parser_next_token(log_ctx, parser, &token, 1);
        if (ret != 0)
            goto fail;

        switch (token.type) {
        case TOKEN_EOF:
            if (subprogram) {
                vgs_log_invalid_token(log_ctx, parser, &token, "Expected '}'.");
                goto fail;
            } else {
                // Move the proc names to the main program.
                FFSWAP(const char **, program->proc_names, parser->proc_names);
                FFSWAP(int, program->proc_names_count, parser->proc_names_count);
            }

            return 0;

        case TOKEN_WORD:
            // The token must be a valid instruction.
            inst = vgs_get_instruction(token.lexeme, token.length);
            if (inst == NULL)
                goto invalid_token;

            ret = vgs_parse_statement(log_ctx, parser, program, inst);
            if (ret != 0)
                goto fail;

            break;

        case TOKEN_RIGHT_BRACKET:
            if (!subprogram)
                goto invalid_token;

            return 0;

        default:
            goto invalid_token;
        }
    }

    return AVERROR_BUG; /* unreachable */

invalid_token:
    vgs_log_invalid_token(log_ctx, parser, &token, "Expected instruction.");

fail:
    vgs_free(program);
    return AVERROR(EINVAL);
}

// Interpreter.

#define MAX_PROC_ARGS 2

#define RANDOM_STATES 4

struct VGSProcedure {
    struct VGSProgram *program;
    int args[MAX_PROC_ARGS];
};

struct VGSEvalState {
    void *log_ctx;

    /// Cairo context for drawing operations.
    cairo_t *cairo_ctx;

    /// Pattern being built by instructions like `colorstop`.
    cairo_pattern_t *pattern_builder;

    /// Register if `break` was called in a subprogram.
    int interrupted;

    /// Next call to `[eo]fill`, `[eo]clip`, or `stroke`, should use
    /// the `_preserve` function.
    int preserve_path;

    /// Subprograms associated to each procedure identifier.
    struct VGSProcedure *procedures;

    /// Procedure name for each identifier.
    const char *const *proc_names;

    /// Values for the variables in expressions.
    ///
    /// Some variables (like `cx` or `cy`) are written before
    /// executing each statement.
    double vars[VAR_COUNT];

    /// State for each index available for the `randomg` function.
    FFSFC64 random_state[RANDOM_STATES];

    /// Frame metadata, if any.
    AVDictionary *metadata;

    // Reflected Control Points. Used in T and S instructions.
    //
    // See https://www.w3.org/TR/SVG/paths.html#ReflectedControlPoints
    struct {
        enum { RCP_NONE, RCP_VALID, RCP_UPDATED } status;

        double cubic_x;
        double cubic_y;
        double quad_x;
        double quad_y;
    } rcp;
};

// Function `getvar(i)` for `av_expr_eval`.
//
// Return the value of the `VAR_U<i>` variable.
static double vgs_fn_getvar(void *data, double arg) {
    int var;
    const struct VGSEvalState *state = (struct VGSEvalState *)data;

    if (!isfinite(arg))
        return NAN;

    var = (int)arg;
    if (var >= 0 && var < USER_VAR_COUNT)
        return state->vars[VAR_U0 + var];

    return NAN;
}

// Function `pathlen(n)` for `av_expr_eval`.
//
// Compute the length of the current path. If `n > 0`, it is the
// maximum number of segments to be added to the length.
static double vgs_fn_pathlen(void *data, double arg) {
    const struct VGSEvalState *state = (struct VGSEvalState *)data;

    int max_segments = (int)arg;

    cairo_path_t *path;
    double length = 0;

    double lmx = NAN, lmy = NAN; // last move point
    double cx = NAN, cy = NAN;   // current point.

    path = cairo_copy_path_flat(state->cairo_ctx);

    for (int i = 0; i < path->num_data; i += path->data[i].header.length) {
        double x, y;
        cairo_path_data_t *data = &path->data[i];

        switch (data[0].header.type) {
        case CAIRO_PATH_MOVE_TO:
            cx = lmx = data[1].point.x;
            cy = lmy = data[1].point.y;

            // Don't update `length`.
            continue;

        case CAIRO_PATH_LINE_TO:
            x = data[1].point.x;
            y = data[1].point.y;
            break;

        case CAIRO_PATH_CLOSE_PATH:
            x = lmx;
            y = lmy;
            break;

        default:
            continue;
        }

        length += hypot(cx - x, cy - y);

        cx = x;
        cy = y;

        // If the function argument is `> 0`, use it as a limit for how
        // many segments are added.
        if (--max_segments == 0)
            break;
    }

    cairo_path_destroy(path);

    return length;
}

// Compute a random value between 0 and 1. Similar to `random`, but the
// generator is global to the VGS program.
//
// The last 2 bits of the integer representation of the argument are used
// as the state index. If the state is not initialized, the value is used
// as the seed.
static double vgs_fn_randomg(void *data, double arg) {
    int rng_idx;
    uint64_t iarg;

    FFSFC64 *rng;
    struct VGSEvalState *state = (struct VGSEvalState *)data;

    if (!isfinite(arg))
        return arg;

    iarg = (uint64_t)arg;
    rng_idx = iarg & (RANDOM_STATES - 1);
    av_assert0(rng_idx >= 0 && rng_idx < RANDOM_STATES);

    rng = &state->random_state[rng_idx];

    if (rng->counter == 0)
        ff_sfc64_init(rng, iarg, iarg, iarg, 12);

    return ff_sfc64_get(rng) * (1.0 / UINT64_MAX);
}

static void vgs_eval_state_init(
    struct VGSEvalState *state,
    const struct VGSProgram *program,
    void *log_ctx
) {
    memset(state, 0, sizeof(*state));

    state->log_ctx = log_ctx;
    state->rcp.status = RCP_NONE;

    if (program->proc_names != NULL) {
        state->procedures = av_calloc(sizeof(struct VGSProcedure), program->proc_names_count);
        state->proc_names = program->proc_names;
    }

    for (int i = 0; i < VAR_COUNT; i++)
        state->vars[i] = NAN;
}

static void vgs_eval_state_free(struct VGSEvalState *state) {
    if (state->pattern_builder != NULL)
        cairo_pattern_destroy(state->pattern_builder);

    if (state->procedures != NULL)
        av_free(state->procedures);

    memset(state, 0, sizeof(*state));
}

static void draw_ellipse(cairo_t *c, double x, double y, double rx, double ry) {
    cairo_save(c);
    cairo_translate(c, x, y);

    if (rx != ry) {
        // Cairo does not support ellipses, but it can be created by
        // adjusting the transformation matrix.
        cairo_scale(c, 1, ry / rx);
    }

    cairo_new_sub_path(c);
    cairo_arc(c, 0, 0, rx, 0, 2 * M_PI);
    cairo_close_path(c);
    cairo_new_sub_path(c);

    cairo_restore(c);
}

// Render a quadratic bezier from the current point to `x, y`, The control point
// is specified by `x1, y1`.
//
// If the control point is NAN, use the reflected point.
//
// cairo only supports cubic cuvers, so we have to transform the control points.
static void quad_curve_to(
    struct VGSEvalState *state,
    int relative,
    double x1,
    double y1,
    double x,
    double y
) {
    double x0 = 0, y0 = 0;  // Current point.
    double xa, ya, xb, yb;  // Control points for the cubic curve.

    int use_reflected = isnan(x1);

    cairo_get_current_point(state->cairo_ctx, &x0, &y0);

    if (relative) {
        if (!use_reflected) {
            x1 += x0;
            y1 += y0;
        }

        x += x0;
        y += y0;
    }

    if (use_reflected) {
        if (state->rcp.status != RCP_NONE) {
            x1 = state->rcp.quad_x;
            y1 = state->rcp.quad_y;
        } else {
            x1 = x0;
            y1 = y0;
        }
    }

    xa = (x0 + 2 * x1) / 3;
    ya = (y0 + 2 * y1) / 3;
    xb = (x + 2 * x1) / 3;
    yb = (y + 2 * y1) / 3;
    cairo_curve_to(state->cairo_ctx, xa, ya, xb, yb, x, y);

    state->rcp.status = RCP_UPDATED;
    state->rcp.cubic_x = x1;
    state->rcp.cubic_y = y1;
    state->rcp.quad_x = 2 * x - x1;
    state->rcp.quad_y = 2 * y - y1;
}

// Similar to quad_curve_to, but for cubic curves.
static void cubic_curve_to(
    struct VGSEvalState *state,
    int relative,
    double x1,
    double y1,
    double x2,
    double y2,
    double x,
    double y
) {
    double x0 = 0, y0 = 0; // Current point.

    int use_reflected = isnan(x1);

    cairo_get_current_point(state->cairo_ctx, &x0, &y0);

    if (relative) {
        if (!use_reflected) {
            x1 += x0;
            y1 += y0;
        }

        x += x0;
        y += y0;
        x2 += x0;
        y2 += y0;
    }

    if (use_reflected) {
        if (state->rcp.status != RCP_NONE) {
            x1 = state->rcp.cubic_x;
            y1 = state->rcp.cubic_y;
        } else {
            x1 = x0;
            y1 = y0;
        }
    }

    cairo_curve_to(state->cairo_ctx, x1, y1, x2, y2, x, y);

    state->rcp.status = RCP_UPDATED;
    state->rcp.cubic_x = 2 * x - x2;
    state->rcp.cubic_y = 2 * y - y2;
    state->rcp.quad_x = x2;
    state->rcp.quad_y = y2;
}

static void rounded_rect(
    cairo_t *c,
    double x,
    double y,
    double width,
    double height,
    double radius
) {
    radius = av_clipd(radius, 0, FFMIN(height / 2, width / 2));

    cairo_new_sub_path(c);
    cairo_arc(c, x + radius, y + radius, radius, M_PI, 3 * M_PI / 2);
    cairo_arc(c, x + width - radius, y + radius, radius, 3 * M_PI / 2, 2 * M_PI);
    cairo_arc(c, x + width - radius, y + height - radius, radius, 0, M_PI / 2);
    cairo_arc(c, x + radius, y + height - radius, radius, M_PI / 2, M_PI);
    cairo_close_path(c);
}

static void hsl2rgb(
    double h,
    double s,
    double l,
    double *pr,
    double *pg,
    double *pb
) {
    // https://en.wikipedia.org/wiki/HSL_and_HSV#HSL_to_RGB

    double r, g, b, chroma, x, h1;

    if (h < 0 || h >= 360)
        h = fmod(FFMAX(h, 0), 360);

    s = av_clipd(s, 0, 1);
    l = av_clipd(l, 0, 1);

    chroma = (1 - fabs(2 * l - 1)) * s;
    h1 = h / 60;
    x = chroma * (1 - fabs(fmod(h1, 2) - 1));

    switch ((int)floor(h1)) {
    case 0:
        r = chroma;
        g = x;
        b = 0;
        break;

    case 1:
        r = x;
        g = chroma;
        b = 0;
        break;

    case 2:
        r = 0;
        g = chroma;
        b = x;
        break;

    case 3:
        r = 0;
        g = x;
        b = chroma;
        break;

    case 4:
        r = x;
        g = 0;
        b = chroma;
        break;

    default:
        r = chroma;
        g = 0;
        b = x;
        break;

    }

    x = l - chroma / 2;

    *pr = r + x;
    *pg = g + x;
    *pb = b + x;
}

// Convert a color in 4 components, between 0.0 and 1.0,
// to a 0xRRGGBBAA value.
static uint32_t vgs_color_value(double r, double g, double b, double a) {
#define C(v, o) ((uint32_t)(av_clipd(v, 0, 1) * 255) << o)

    return C(r, 24) | C(g, 16) | C(b, 8) | C(a, 0);

#undef C
}

// Execute the cairo functions for the given script.
static int vgs_eval(
    struct VGSEvalState *state,
    const struct VGSProgram *program
) {

#define ASSERT_ARGS(n) av_assert0(statement->args_count == n)

#define MAY_PRESERVE(funcname) \
    do {                                           \
        if (state->preserve_path) {                \
            state->preserve_path = 0;              \
            funcname##_preserve(state->cairo_ctx); \
        } else {                                   \
            funcname(state->cairo_ctx);            \
        }                                          \
    } while(0)

    double numerics[MAX_INSTRUCTION_PARAMS];
    double colors[MAX_INSTRUCTION_PARAMS][4];

    double cx, cy; // Current point.

    int relative;

    for (int st_number = 0; st_number < program->statements_count; st_number++) {
        const struct VGSStatement *statement = &program->statements[st_number];

        if (statement->args_count > FF_ARRAY_ELEMS(numerics)) {
            av_log(state->log_ctx, AV_LOG_ERROR, "Too many arguments (%d).\n", statement->args_count);
            return AVERROR_BUG;
        }

        if (cairo_has_current_point(state->cairo_ctx)) {
            cairo_get_current_point(state->cairo_ctx, &cx, &cy);
        } else {
            cx = NAN;
            cy = NAN;
        }

        state->vars[VAR_CX] = cx;
        state->vars[VAR_CY] = cy;

        for (int arg = 0; arg < statement->args_count; arg++) {
            uint8_t color[4];

            const struct VGSArgument *a = &statement->args[arg];

            switch (a->type) {
            case ARG_COLOR:
            case ARG_COLOR_VAR:
                if (a->type == ARG_COLOR) {
                    memcpy(color, a->color, sizeof(color));
                } else {
                    uint32_t c = av_be2ne32((uint32_t)state->vars[a->variable]);
                    memcpy(color, &c, sizeof(color));
                }

                colors[arg][0] = (double)(color[0]) / 255.0,
                colors[arg][1] = (double)(color[1]) / 255.0,
                colors[arg][2] = (double)(color[2]) / 255.0,
                colors[arg][3] = (double)(color[3]) / 255.0;
                break;

            case ARG_EXPR:
                numerics[arg] = av_expr_eval(a->expr, state->vars, state);
                break;

            case ARG_LITERAL:
                numerics[arg] = a->literal;
                break;

            case ARG_VARIABLE:
                av_assert0(a->variable < VAR_COUNT);
                numerics[arg] = state->vars[a->variable];
                break;

            default:
                numerics[arg] = NAN;
                break;
            }
        }

        // If the instruction uses a pending pattern (like a solid color
        // or a gradient), set it to the cairo context before executing
        // stroke/fill instructions.
        if (state->pattern_builder != NULL) {
            switch (statement->inst) {
            case INS_FILL:
            case INS_FILL_EO:
            case INS_RESTORE:
            case INS_SAVE:
            case INS_STROKE:
                cairo_set_source(state->cairo_ctx, state->pattern_builder);
                cairo_pattern_destroy(state->pattern_builder);
                state->pattern_builder = NULL;
            }
        }

        // Execute the instruction.
        switch (statement->inst) {
        case INS_ARC:
            ASSERT_ARGS(5);
            cairo_arc(
                state->cairo_ctx,
                numerics[0],
                numerics[1],
                numerics[2],
                numerics[3],
                numerics[4]
            );
            break;

        case INS_ARC_NEG:
            ASSERT_ARGS(5);
            cairo_arc_negative(
                state->cairo_ctx,
                numerics[0],
                numerics[1],
                numerics[2],
                numerics[3],
                numerics[4]
            );
            break;

        case INS_CIRCLE:
            ASSERT_ARGS(3);
            draw_ellipse(state->cairo_ctx, numerics[0], numerics[1], numerics[2], numerics[2]);
            break;

        case INS_CLIP:
        case INS_CLIP_EO:
            ASSERT_ARGS(0);
            cairo_set_fill_rule(
                state->cairo_ctx,
                statement->inst == INS_CLIP ?
                    CAIRO_FILL_RULE_WINDING :
                    CAIRO_FILL_RULE_EVEN_ODD
            );

            MAY_PRESERVE(cairo_clip);
            break;

        case INS_CLOSE_PATH:
            ASSERT_ARGS(0);
            cairo_close_path(state->cairo_ctx);
            break;

        case INS_COLOR_STOP:
            if (state->pattern_builder == NULL) {
                av_log(state->log_ctx, AV_LOG_ERROR, "colorstop with no active gradient.\n");
                break;
            }

            ASSERT_ARGS(2);
            cairo_pattern_add_color_stop_rgba(
                state->pattern_builder,
                numerics[0],
                colors[1][0],
                colors[1][1],
                colors[1][2],
                colors[1][3]
            );
            break;

        case INS_CURVE_TO:
        case INS_CURVE_TO_REL:
            ASSERT_ARGS(6);
            cubic_curve_to(
                state,
                statement->inst == INS_CURVE_TO_REL,
                numerics[0],
                numerics[1],
                numerics[2],
                numerics[3],
                numerics[4],
                numerics[5]
            );
            break;

        case INS_DEF_HSLA:
        case INS_DEF_RGBA: {
            int user_var;
            double r, g, b;

            ASSERT_ARGS(5);

            user_var = statement->args[0].variable;

            av_assert0(user_var >= VAR_U0 && user_var < (VAR_U0 + USER_VAR_COUNT));

            if (statement->inst == INS_DEF_HSLA) {
                hsl2rgb(numerics[1], numerics[2], numerics[3], &r, &g, &b);
            } else {
                r = numerics[1];
                g = numerics[2];
                b = numerics[3];
            }

            state->vars[user_var] = (double)vgs_color_value(r, g, b, numerics[4]);
            break;
        }

        case INS_ELLIPSE:
            ASSERT_ARGS(4);
            draw_ellipse(state->cairo_ctx, numerics[0], numerics[1], numerics[2], numerics[3]);
            break;

        case INS_FILL:
        case INS_FILL_EO:
            ASSERT_ARGS(0);

            cairo_set_fill_rule(
                state->cairo_ctx,
                statement->inst == INS_FILL ?
                    CAIRO_FILL_RULE_WINDING :
                    CAIRO_FILL_RULE_EVEN_ODD
            );

            MAY_PRESERVE(cairo_fill);
            break;

        case INS_GET_METADATA: {
            int user_var;
            char *key, *endp;

            double value;

            AVDictionaryEntry* entry;

            ASSERT_ARGS(2);

            user_var = statement->args[0].constant;
            key = statement->args[1].metadata;

            value = NAN;

            av_assert0(user_var >= VAR_U0 && user_var < (VAR_U0 + USER_VAR_COUNT));

            if (state->metadata != NULL && key != NULL) {
                entry = av_dict_get(state->metadata, key, NULL, 0);

                if (entry != NULL) {
                    value = av_strtod(entry->value, &endp);

                    if (*endp != '\0')
                        value = NAN;
                }
            }

            state->vars[user_var] = value;
            break;
        }

        case INS_BREAK:
            state->interrupted = 1;
            return 0;

        case INS_IF:
            ASSERT_ARGS(2);

            if (isfinite(numerics[0]) && numerics[0] != 0.0) {
                int ret = vgs_eval(state, statement->args[1].subprogram);
                if (ret != 0 || state->interrupted != 0)
                    return ret;
            }

            break;

        case INS_LINEAR_GRAD:
            ASSERT_ARGS(4);

            if (state->pattern_builder != NULL)
                cairo_pattern_destroy(state->pattern_builder);

            state->pattern_builder = cairo_pattern_create_linear(
                numerics[0],
                numerics[1],
                numerics[2],
                numerics[3]
            );
            break;

        case INS_LINE_TO:
            ASSERT_ARGS(2);
            cairo_line_to(state->cairo_ctx, numerics[0], numerics[1]);
            break;

        case INS_LINE_TO_REL:
            ASSERT_ARGS(2);
            cairo_rel_line_to(state->cairo_ctx, numerics[0], numerics[1]);
            break;

        case INS_MOVE_TO:
            ASSERT_ARGS(2);
            cairo_move_to(state->cairo_ctx, numerics[0], numerics[1]);
            break;

        case INS_MOVE_TO_REL:
            ASSERT_ARGS(2);
            cairo_rel_move_to(state->cairo_ctx, numerics[0], numerics[1]);
            break;

        case INS_NEW_PATH:
            ASSERT_ARGS(0);
            cairo_new_sub_path(state->cairo_ctx);
            break;

        case INS_PRESERVE:
            ASSERT_ARGS(0);
            state->preserve_path = 1;
            break;

        case INS_PRINT: {
            char msg[256];
            int len = 0;

            for (int i = 0; i < statement->args_count; i++) {
                int written;
                int capacity = sizeof(msg) - len;

                written = snprintf(
                    msg + len,
                    capacity,
                    "%s%s = %f",
                    i > 0 ? " | " : "",
                    statement->args[i].metadata,
                    numerics[i]
                );

                // If buffer is too small, discard the latest arguments.
                if (written >= capacity)
                    break;

                len += written;
            }

            av_log(state->log_ctx, AV_LOG_INFO, "%.*s\n", len, msg);
            break;
        }

        case INS_PROC_ASSIGN:
        case INS_PROC1_ASSIGN:
        case INS_PROC2_ASSIGN: {
            int proc_args;
            struct VGSProcedure *proc;

            proc_args = vgs_proc_num_args(statement->inst);

            ASSERT_ARGS(2 + proc_args);

            proc = &state->procedures[statement->args[0].proc_id];

            proc->program = statement->args[proc_args + 1].subprogram;

            for (int i = 0; i < MAX_PROC_ARGS; i++)
                proc->args[i] = i < proc_args ? statement->args[i + 1].constant : -1;

            break;
        }

        case INS_PROC_CALL:
        case INS_PROC1_CALL:
        case INS_PROC2_CALL: {
            int proc_args;
            int proc_id;

            const struct VGSProcedure *proc;

            proc_args = vgs_proc_num_args(statement->inst);

            ASSERT_ARGS(1 + proc_args);
            proc_id = statement->args[0].proc_id;

            proc = &state->procedures[proc_id];
            if (proc->program == NULL) {
                const char *proc_name = state->proc_names[proc_id];
                av_log(state->log_ctx, AV_LOG_ERROR, "Missing procedure for '%s'\n", proc_name);
            } else {
                int ret;
                double current_vars[MAX_PROC_ARGS] = { 0 };

                // Set variables for the procedure arguments
                for (int i = 0; i < proc_args; i++) {
                    int var = proc->args[i];
                    if (var != -1) {
                        current_vars[i] = state->vars[var];
                        state->vars[var] = numerics[i + 1];
                    }
                }

                ret = vgs_eval(state, proc->program);

                // Restore variable values.
                for (int i = 0; i < proc_args; i++) {
                    int var = proc->args[i];
                    if (var != -1) {
                        state->vars[var] = current_vars[i];
                    }
                }

                if (ret != 0)
                    return ret;

                // `break` interrupts the procedure, but don't stop the program.
                if (state->interrupted) {
                    state->interrupted = 0;
                    break;
                }
            }

            break;
        }

        case INS_Q_CURVE_TO:
        case INS_Q_CURVE_TO_REL:
            ASSERT_ARGS(4);
            relative = statement->inst == INS_Q_CURVE_TO_REL;
            quad_curve_to(state, relative, numerics[0], numerics[1], numerics[2], numerics[3]);
            break;

        case INS_RADIAL_GRAD:
            ASSERT_ARGS(6);

            if (state->pattern_builder != NULL)
                cairo_pattern_destroy(state->pattern_builder);

            state->pattern_builder = cairo_pattern_create_radial(
                numerics[0],
                numerics[1],
                numerics[2],
                numerics[3],
                numerics[4],
                numerics[5]
            );
            break;

        case INS_RESET_CLIP:
            cairo_reset_clip(state->cairo_ctx);
            break;

        case INS_RESET_DASH:
            cairo_set_dash(state->cairo_ctx, NULL, 0, 0);
            break;

        case INS_RECT:
            ASSERT_ARGS(4);
            cairo_rectangle(state->cairo_ctx, numerics[0], numerics[1], numerics[2], numerics[3]);
            break;

        case INS_REPEAT: {
            double var_i = state->vars[VAR_I];

            ASSERT_ARGS(2);

            if (!isfinite(numerics[0]))
                break;

            for (int i = 0, count = (int)numerics[0]; i < count; i++) {
                int ret;

                state->vars[VAR_I] = i;
                ret = vgs_eval(state, statement->args[1].subprogram);
                if (ret != 0)
                    return ret;

                // `break` interrupts the loop, but don't stop the program.
                if (state->interrupted) {
                    state->interrupted = 0;
                    break;
                }
            }

            state->vars[VAR_I] = var_i;
            break;
        }

        case INS_RESTORE:
            ASSERT_ARGS(0);
            cairo_restore(state->cairo_ctx);
            break;

        case INS_ROTATE:
            ASSERT_ARGS(1);
            cairo_rotate(state->cairo_ctx, numerics[0]);
            break;

        case INS_ROUNDEDRECT:
            ASSERT_ARGS(5);
            rounded_rect(
                state->cairo_ctx,
                numerics[0],
                numerics[1],
                numerics[2],
                numerics[3],
                numerics[4]
            );
            break;

        case INS_SAVE:
            ASSERT_ARGS(0);
            cairo_save(state->cairo_ctx);
            break;

        case INS_SCALE:
            ASSERT_ARGS(1);
            cairo_scale(state->cairo_ctx, numerics[0], numerics[0]);
            break;

        case INS_SCALEXY:
            ASSERT_ARGS(2);
            cairo_scale(state->cairo_ctx, numerics[0], numerics[1]);
            break;

        case INS_SET_COLOR:
            ASSERT_ARGS(1);

            if (state->pattern_builder != NULL)
                cairo_pattern_destroy(state->pattern_builder);

            state->pattern_builder = cairo_pattern_create_rgba(
                colors[0][0],
                colors[0][1],
                colors[0][2],
                colors[0][3]
            );
            break;

        case INS_SET_LINE_CAP:
            ASSERT_ARGS(1);
            cairo_set_line_cap(state->cairo_ctx, statement->args[0].constant);
            break;

        case INS_SET_LINE_JOIN:
            ASSERT_ARGS(1);
            cairo_set_line_join(state->cairo_ctx, statement->args[0].constant);
            break;

        case INS_SET_LINE_WIDTH:
            ASSERT_ARGS(1);
            cairo_set_line_width(state->cairo_ctx, numerics[0]);
            break;

        case INS_SET_DASH:
        case INS_SET_DASH_OFFSET: {
            int num;
            double *dashes, offset, stack_buf[16];

            ASSERT_ARGS(1);

            num = cairo_get_dash_count(state->cairo_ctx);

            if (num + 1 < FF_ARRAY_ELEMS(stack_buf)) {
                dashes = stack_buf;
            } else {
                dashes = av_calloc(num + 1, sizeof(double));
            }

            cairo_get_dash(state->cairo_ctx, dashes, &offset);

            if (statement->inst == INS_SET_DASH) {
                dashes[num] = numerics[0];
                num++;
            } else {
                offset = numerics[0];
            }

            cairo_set_dash(state->cairo_ctx, dashes, num, offset);

            if (dashes != stack_buf)
                av_freep(&dashes);

            break;
        }

        case INS_SET_HSLA:
        case INS_SET_RGBA: {
            double r, g, b;

            ASSERT_ARGS(4);

            if (state->pattern_builder != NULL)
                cairo_pattern_destroy(state->pattern_builder);

            if (statement->inst == INS_SET_HSLA) {
                hsl2rgb(numerics[0], numerics[1], numerics[2], &r, &g, &b);
            } else {
                r = numerics[0];
                g = numerics[1];
                b = numerics[2];
            }

            state->pattern_builder = cairo_pattern_create_rgba(r, g, b, numerics[3]);
            break;
        }

        case INS_SET_VAR: {
            int user_var;

            ASSERT_ARGS(2);

            user_var = statement->args[0].constant;

            av_assert0(user_var >= VAR_U0 && user_var < (VAR_U0 + USER_VAR_COUNT));
            state->vars[user_var] = numerics[1];
            break;
        }

        case INS_STROKE:
            ASSERT_ARGS(0);
            MAY_PRESERVE(cairo_stroke);
            break;

        case INS_S_CURVE_TO:
        case INS_S_CURVE_TO_REL:
            ASSERT_ARGS(4);
            cubic_curve_to(
                state,
                statement->inst == INS_S_CURVE_TO_REL,
                NAN,
                NAN,
                numerics[0],
                numerics[1],
                numerics[2],
                numerics[3]
            );
            break;

        case INS_TRANSLATE:
            ASSERT_ARGS(2);
            cairo_translate(state->cairo_ctx, numerics[0], numerics[1]);
            break;

        case INS_T_CURVE_TO:
        case INS_T_CURVE_TO_REL:
            ASSERT_ARGS(2);
            relative = statement->inst == INS_T_CURVE_TO_REL;
            quad_curve_to(state, relative, NAN, NAN, numerics[0], numerics[1]);
            break;

        case INS_HORZ:
        case INS_HORZ_REL:
        case INS_VERT:
        case INS_VERT_REL:
            ASSERT_ARGS(1);

            if (cairo_has_current_point(state->cairo_ctx)) {
                double d = numerics[0];

                switch (statement->inst) {
                    case INS_HORZ:     cx  = d; break;
                    case INS_VERT:     cy  = d; break;
                    case INS_HORZ_REL: cx += d; break;
                    case INS_VERT_REL: cy += d; break;
                }

                cairo_line_to(state->cairo_ctx, cx, cy);
            }

            break;
        }

        // Reflected control points will be discarded if the executed
        // instruction did not update them, and it is a instruction
        // to modify the path.
        if (state->rcp.status == RCP_UPDATED) {
            state->rcp.status = RCP_VALID;
        } else if (vgs_inst_change_path(statement->inst)) {
            state->rcp.status = RCP_NONE;
        }
    }

    return 0;
}


typedef struct DrawVGContext {
    const AVClass *class;

    cairo_format_t cairo_format;    ///< equivalent to AVPixelFormat

    uint8_t *script_text;           ///< inline source.
    uint8_t *script_file;           ///< file with the script.
    struct VGSProgram program;
} DrawVGContext;

#define OFFSET(x) offsetof(DrawVGContext, x)

#define FLAGS AV_OPT_FLAG_FILTERING_PARAM | AV_OPT_FLAG_VIDEO_PARAM

#define OPT(name, field, help) \
    {                          \
        name,                  \
        help,                  \
        OFFSET(field),         \
        AV_OPT_TYPE_STRING,    \
        { .str = NULL },       \
        0, 0,                  \
        FLAGS                  \
    }

static const AVOption drawvg_options[]= {
    OPT("script", script_text, "script source to draw the graphics"),
    OPT("s",      script_text, "script source to draw the graphics"),
    OPT("file",   script_file, "file to load the script source"),
    { NULL }
};

#undef OFFSET
#undef FLAGS
#undef OPT


AVFILTER_DEFINE_CLASS(drawvg);

static const enum AVPixelFormat drawvg_pix_fmts[] = {
    AV_PIX_FMT_RGB32,
    AV_PIX_FMT_0RGB32,
    AV_PIX_FMT_RGB565,
    AV_PIX_FMT_X2RGB10,
    AV_PIX_FMT_NONE
};

// Return the cairo equivalent to AVPixelFormat.
static cairo_format_t cairo_format_from_pix_fmt(DrawVGContext* ctx, enum AVPixelFormat format) {
    // This array must have the same order of `pixel_fmts_drawvg`.
    const cairo_format_t format_map[] = {
        CAIRO_FORMAT_ARGB32, // cairo expects pre-multiplied alpha.
        CAIRO_FORMAT_RGB24,
        CAIRO_FORMAT_RGB16_565,
        CAIRO_FORMAT_RGB30,
        CAIRO_FORMAT_INVALID,
    };

    const char* pix_fmt_name = av_get_pix_fmt_name(format);

    for (int i = 0; i < FF_ARRAY_ELEMS(drawvg_pix_fmts); i++) {
        if (drawvg_pix_fmts[i] == format) {
            cairo_format_t fmt = format_map[i];

            av_log(ctx, AV_LOG_TRACE, "Use cairo_format_t#%d for %s\n",
                fmt, pix_fmt_name);

            return fmt;
        }
    }

    av_log(ctx, AV_LOG_ERROR, "Invalid pix_fmt: %s\n", pix_fmt_name);
    return CAIRO_FORMAT_INVALID;
}

static int drawvg_filter_frame(AVFilterLink *inlink, AVFrame *frame) {
    int ret;
    cairo_surface_t* surface;

    FilterLink *inl = ff_filter_link(inlink);
    AVFilterLink *outlink = inlink->dst->outputs[0];
    AVFilterContext *filter_ctx = inlink->dst;
    DrawVGContext *drawvg_ctx = filter_ctx->priv;

    struct VGSEvalState eval_state;
    vgs_eval_state_init(&eval_state, &drawvg_ctx->program, drawvg_ctx);

    // Draw directly on the frame data.
    surface = cairo_image_surface_create_for_data(
        frame->data[0],
        drawvg_ctx->cairo_format,
        frame->width,
        frame->height,
        frame->linesize[0]
    );

    if (cairo_surface_status(surface) != CAIRO_STATUS_SUCCESS) {
        av_log(drawvg_ctx, AV_LOG_ERROR, "Failed to create cairo surface.\n");
        return AVERROR_EXTERNAL;
    }

    eval_state.cairo_ctx = cairo_create(surface);

    eval_state.vars[VAR_N] = inl->frame_count_out;
    eval_state.vars[VAR_T] = frame->pts == AV_NOPTS_VALUE ? NAN : frame->pts * av_q2d(inlink->time_base);
    eval_state.vars[VAR_W] = inlink->w;
    eval_state.vars[VAR_H] = inlink->h;
    eval_state.vars[VAR_DURATION] = frame->duration * av_q2d(inlink->time_base);

    eval_state.metadata = frame->metadata;

    ret = vgs_eval(&eval_state, &drawvg_ctx->program);

    cairo_destroy(eval_state.cairo_ctx);
    cairo_surface_destroy(surface);

    vgs_eval_state_free(&eval_state);

    if (ret != 0)
        return ret;

    return ff_filter_frame(outlink, frame);
}

static int drawvg_config_props(AVFilterLink *inlink) {
    AVFilterContext *filter_ctx = inlink->dst;
    DrawVGContext *drawvg_ctx = filter_ctx->priv;

    // Find the cairo format equivalent to the format of the frame,
    // so cairo can draw directly on the frame data.

    drawvg_ctx->cairo_format = cairo_format_from_pix_fmt(drawvg_ctx, inlink->format);
    if (drawvg_ctx->cairo_format == CAIRO_FORMAT_INVALID)
        return AVERROR(EINVAL);

    return 0;
}

static av_cold int drawvg_init(AVFilterContext *ctx) {
    int ret;
    struct VGSParser parser;
    DrawVGContext *drawvg = ctx->priv;

    if (drawvg->script_file != NULL) {
        ret = ff_load_textfile(
            ctx,
            (const char *)drawvg->script_file,
            &drawvg->script_text,
            NULL
        );

        if (ret != 0)
            return ret;
    }

    vgs_parser_init(&parser, drawvg->script_text);

    ret = vgs_parse(drawvg, &parser, &drawvg->program, 0);

    vgs_parser_free(&parser);

    return ret;
}

static av_cold void drawvg_uninit(AVFilterContext *ctx) {
    DrawVGContext *drawvg = ctx->priv;
    vgs_free(&drawvg->program);
}

static const AVFilterPad drawvg_inputs[] = {
    {
        .name         = "default",
        .type         = AVMEDIA_TYPE_VIDEO,
        .flags        = AVFILTERPAD_FLAG_NEEDS_WRITABLE,
        .filter_frame = drawvg_filter_frame,
        .config_props = drawvg_config_props,
    },
};

const FFFilter ff_vf_drawvg = {
    .p.name        = "drawvg",
    .p.description = NULL_IF_CONFIG_SMALL("Draw vector graphics on top of video frames."),
    .p.priv_class  = &drawvg_class,
    .p.flags       = AVFILTER_FLAG_SUPPORT_TIMELINE_GENERIC,
    .priv_size     = sizeof(DrawVGContext),
    .init          = drawvg_init,
    .uninit        = drawvg_uninit,
    FILTER_INPUTS(drawvg_inputs),
    FILTER_OUTPUTS(ff_video_default_filterpad),
    FILTER_PIXFMTS_ARRAY(drawvg_pix_fmts),
};
