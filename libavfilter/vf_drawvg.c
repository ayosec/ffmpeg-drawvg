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
#include "libavutil/eval.h"
#include "libavutil/internal.h"
#include "libavutil/mem.h"
#include "libavutil/opt.h"
#include "libavutil/pixdesc.h"

#include "avfilter.h"
#include "filters.h"
#include "textutils.h"
#include "video.h"

struct DrawVGContext;

// Variables to evaluate expressions.

enum {
    VAR_N,          ///< Frame number.
    VAR_T,          ///< Timestamp in seconds.
    VAR_W,          ///< Frame width.
    VAR_H,          ///< Frame height.
    VAR_DURATION,   ///< Frame duration.
    VAR_CX,         ///< X coordinate for current point.
    VAR_CY,         ///< Y coordinate for current point.
    VAR_I,          ///< Loop counter.
};

static const char *const var_names[] = {
    "n",
    "t",
    "w",
    "h",
    "duration",
    "cx",
    "cy",
    "i",
    NULL,
};

#define VAR_COUNT (FF_ARRAY_ELEMS(var_names) - 1)

static const char *const vgs_func1_names[] = {
    "peek",
    "pop",
    NULL,
};

static double vgs_fn_peek(void*, double);
static double vgs_fn_pop(void*, double);

static double (*const vgs_func1_impls[])(void *, double) = {
    vgs_fn_peek,
    vgs_fn_pop,
    NULL,
};


enum VGSInstruction {
    INS_ARC = 1,                ///<  arc (cx cy radius angle1 angle2)
    INS_ARC_NEG,                ///<  arcn (cx cy radius angle1 angle2)
    INS_CIRCLE,                 ///<  circle (cx cy radius)
    INS_CLIP,                   ///<  clip
    INS_CLIP_EO,                ///<  eoclip
    INS_CLOSE_PATH,             ///<  Z, z, closepath
    INS_COLOR_STOP,             ///<  colorstop (offset color)
    INS_CURVE_TO,               ///<  C, curveto (x1 y1 x2 y2 x y)
    INS_CURVE_TO_REL,           ///<  c, rcurveto (dx1 dy1 dx2 dy2 dx dy)
    INS_ELLIPSE,                ///<  ellipse (cx cy rx ry)
    INS_FILL,                   ///<  fill
    INS_FILL_EO,                ///<  eofill
    INS_FINISH,                 ///<  finish
    INS_HORZ,                   ///<  H (x)
    INS_HORZ_REL,               ///<  h (dx)
    INS_IF,                     ///<  if (condition) { subprogram }
    INS_LINEAR_GRAD,            ///<  lineargrad (x0 y0 x1 y1)
    INS_LINE_TO,                ///<  L, lineto (x y)
    INS_LINE_TO_REL,            ///<  l, rlineto (dx dy)
    INS_MOVE_TO,                ///<  M, moveto (x y)
    INS_MOVE_TO_REL,            ///<  m, rmoveto (dx dy)
    INS_NEW_PATH,               ///<  newpath
    INS_PUSH,                   ///<  push (key value)
    INS_Q_CURVE_TO,             ///<  Q, quadcurveto (x1 y1 x y)
    INS_Q_CURVE_TO_REL,         ///<  q, rquadcurveto (dx1 dy1 dx dy)
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
    INS_SETCOLOR,               ///<  setcolor (color)
    INS_SETLINECAP,             ///<  setlinecap (cap)
    INS_SETLINEJOIN,            ///<  setlinejoin (join)
    INS_SETLINEWIDTH,           ///<  setlinewidth (width)
    INS_SET_DASH,               ///<  setdash (length)
    INS_STROKE,                 ///<  stroke
    INS_S_CURVE_TO,             ///<  S, smoothcurveto (x2 y2 x y)
    INS_S_CURVE_TO_REL,         ///<  s, rsmoothcurveto (dx2 dy2 dx dy)
    INS_TRANSLATE,              ///<  translate (tx ty)
    INS_T_CURVE_TO,             ///<  T, smoothquadcurveto (x y)
    INS_T_CURVE_TO_REL,         ///<  t, rsmoothquadcurveto (dx dy)
    INS_VERT,                   ///<  V (y)
    INS_VERT_REL,               ///<  v (dy)
};

// Instruction arguments.
struct VGSArgument {
    enum {
        SA_CONST = 1,
        SA_LITERAL,
        SA_AV_EXPR,
        SA_COLOR,
        SA_SUBPROGRAM,
    } type;

    union {
        int constant;
        double literal;
        AVExpr *expr;
        uint8_t color[4];
        struct VGSProgram *subprogram;
    };
};

// Program statements.
struct VGSStatement {
    enum VGSInstruction inst;
    const char* inst_name;

    struct VGSArgument *args;
    int args_count;
};

struct VGSProgram {
    struct VGSStatement *statements;
    int statements_count;
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

// Syntax of the instruction arguments.
struct VGSParameters {
    enum {
        // The instruction does not expect any argument.
        PARAMS_NONE = 1,

        // The instruction expects a fixed number of numeric arguments.
        //
        // The field `num` must indicate the size of the set.
        PARAMS_NUMBERS,

        // The instruction expects a sequence of sets. The parser emits an
        // instruction for each complete set.
        //
        // The field `num` must indicate the size of the set.
        //
        // For example, the instruction `L` expects 2 arguments in each set,
        // so the script `L 10 10 20 20` emit two `lineto` instructions:
        // `L 10 20` and `L 20 20`.
        PARAMS_NUMBERS_SEQS,

        // The instruction expects a single argument, which is a keyword
        // from the array in the field `const_names`.
        PARAMS_CONSTANT,

        // The argument is a color, or a list of colors.
        //
        // `num` indicates number of arguments.
        PARAMS_COLORS,

        // The instruction expects a number and a color.
        //
        // If `num` is `1`, the instruction expects a sequence of sets.
        PARAMS_NUMBER_COLOR,

        // The instruction expects a subprogram. The field `num` indicates
        // how many numeric arguments are before the subprogram.
        PARAMS_SUBPROGRAM,
    } type;

    union {
        int num;
        const struct VGSConstant *consts;
    };
};

struct VGSInstructionSpec {
    enum VGSInstruction inst;
    const char* name;
    struct VGSParameters params;
};

// Instructions available to the scripts.
//
// The array must be sorted in ascending order by `name`.
struct VGSInstructionSpec vgs_instructions[] = {
    { INS_CURVE_TO,       "C",                  { PARAMS_NUMBERS_SEQS, { .num = 6 } } },
    { INS_HORZ,           "H",                  { PARAMS_NUMBERS_SEQS, { .num = 1 } } },
    { INS_LINE_TO,        "L",                  { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_MOVE_TO,        "M",                  { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_Q_CURVE_TO,     "Q",                  { PARAMS_NUMBERS_SEQS, { .num = 4 } } },
    { INS_S_CURVE_TO,     "S",                  { PARAMS_NUMBERS_SEQS, { .num = 4 } } },
    { INS_T_CURVE_TO,     "T",                  { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_VERT,           "V",                  { PARAMS_NUMBERS_SEQS, { .num = 1 } } },
    { INS_CLOSE_PATH,     "Z",                  { PARAMS_NONE } },
    { INS_ARC,            "arc",                { PARAMS_NUMBERS_SEQS, { .num = 5 } } },
    { INS_ARC_NEG,        "arcn",               { PARAMS_NUMBERS_SEQS, { .num = 5 } } },
    { INS_CURVE_TO_REL,   "c",                  { PARAMS_NUMBERS_SEQS, { .num = 6 } } },
    { INS_CIRCLE,         "circle",             { PARAMS_NUMBERS_SEQS, { .num = 3 } } },
    { INS_CLIP,           "clip",               { PARAMS_NONE } },
    { INS_CLOSE_PATH,     "closepath",          { PARAMS_NONE } },
    { INS_COLOR_STOP,     "colorstop",          { PARAMS_NUMBER_COLOR, { .num = 1 } } },
    { INS_CURVE_TO,       "curveto",            { PARAMS_NUMBERS_SEQS, { .num = 6 } } },
    { INS_ELLIPSE,        "ellipse",            { PARAMS_NUMBERS_SEQS, { .num = 4 } } },
    { INS_CLIP_EO,        "eoclip",             { PARAMS_NONE } },
    { INS_FILL_EO,        "eofill",             { PARAMS_NONE } },
    { INS_FILL,           "fill",               { PARAMS_NONE } },
    { INS_FINISH,         "finish",             { PARAMS_NONE } },
    { INS_HORZ_REL,       "h",                  { PARAMS_NUMBERS_SEQS, { .num = 1 } } },
    { INS_IF,             "if",                 { PARAMS_SUBPROGRAM, { .num = 1 } } },
    { INS_LINE_TO_REL,    "l",                  { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_LINEAR_GRAD,    "lineargrad",         { PARAMS_NUMBERS, { .num = 4 } } },
    { INS_LINE_TO,        "lineto",             { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_MOVE_TO_REL,    "m",                  { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_MOVE_TO,        "moveto",             { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_NEW_PATH,       "newpath",            { PARAMS_NONE } },
    { INS_PUSH,           "push",               { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_Q_CURVE_TO_REL, "q",                  { PARAMS_NUMBERS_SEQS, { .num = 4 } } },
    { INS_Q_CURVE_TO,     "quadcurveto",        { PARAMS_NUMBERS_SEQS, { .num = 4 } } },
    { INS_RADIAL_GRAD,    "radialgrad",         { PARAMS_NUMBERS, { .num = 6 } } },
    { INS_CURVE_TO_REL,   "rcurveto",           { PARAMS_NUMBERS_SEQS, { .num = 6 } } },
    { INS_RECT,           "rect",               { PARAMS_NUMBERS_SEQS, { .num = 4 } } },
    { INS_REPEAT,         "repeat",             { PARAMS_SUBPROGRAM, { .num = 1 } } },
    { INS_RESET_CLIP,     "resetclip",          { PARAMS_NONE } },
    { INS_RESET_DASH,     "resetdash",          { PARAMS_NONE } },
    { INS_RESTORE,        "restore",            { PARAMS_NONE } },
    { INS_LINE_TO_REL,    "rlineto",            { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_MOVE_TO_REL,    "rmoveto",            { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_ROTATE,         "rotate",             { PARAMS_NUMBERS, { .num = 1 } } },
    { INS_ROUNDEDRECT,    "roundedrect",        { PARAMS_NUMBERS_SEQS, { .num = 5 } } },
    { INS_Q_CURVE_TO_REL, "rquadcurveto",       { PARAMS_NUMBERS_SEQS, { .num = 4 } } },
    { INS_S_CURVE_TO_REL, "rsmoothcurveto",     { PARAMS_NUMBERS_SEQS, { .num = 4 } } },
    { INS_T_CURVE_TO_REL, "rsmoothquadcurveto", { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_S_CURVE_TO_REL, "s",                  { PARAMS_NUMBERS_SEQS, { .num = 4 } } },
    { INS_SAVE,           "save",               { PARAMS_NONE } },
    { INS_SCALE,          "scale",              { PARAMS_NUMBERS, { .num = 1 } } },
    { INS_SCALEXY,        "scalexy",            { PARAMS_NUMBERS, { .num = 2 } } },
    { INS_SETCOLOR,       "setcolor",           { PARAMS_COLORS, { .num = 1 } } },
    { INS_SET_DASH,       "setdash",            { PARAMS_NUMBERS_SEQS, { .num = 1 } } },
    { INS_SETLINECAP,     "setlinecap",         { PARAMS_CONSTANT, { .consts = vgs_consts_line_cap } } },
    { INS_SETLINEJOIN,    "setlinejoin",        { PARAMS_CONSTANT, { .consts = vgs_consts_line_join } } },
    { INS_SETLINEWIDTH,   "setlinewidth",       { PARAMS_NUMBERS, { .num = 1 } } },
    { INS_S_CURVE_TO,     "smoothcurveto",      { PARAMS_NUMBERS_SEQS, { .num = 4 } } },
    { INS_T_CURVE_TO,     "smoothquadcurveto",  { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_STROKE,         "stroke",             { PARAMS_NONE } },
    { INS_T_CURVE_TO_REL, "t",                  { PARAMS_NUMBERS_SEQS, { .num = 2 } } },
    { INS_TRANSLATE,      "translate",          { PARAMS_NUMBERS, { .num = 2 } } },
    { INS_VERT_REL,       "v",                  { PARAMS_NUMBERS_SEQS, { .num = 1 } } },
    { INS_CLOSE_PATH,     "z",                  { PARAMS_NONE } },
};

#define INSTRUCTION_SPECS_COUNT FF_ARRAY_ELEMS(vgs_instructions)

// Comparator for `ScriptInstructionSpec`, to be used with `bsearch(3)`.
static int vgs_comp_instruction_spec(const void *cs1, const void *cs2) {
    return strcmp(
        ((struct VGSInstructionSpec*)cs1)->name,
        ((struct VGSInstructionSpec*)cs2)->name
    );
}

// Return the specs for the given instruction, or `NULL` if the name is not valid.
static struct VGSInstructionSpec* vgs_get_instruction(const char *name, size_t length) {
    char bufname[64];
    struct VGSInstructionSpec key = { .name = bufname };

    if (length >= sizeof(bufname)) {
        return NULL;
    }

    memcpy(bufname, name, length);
    bufname[length] = '\0';

    return bsearch(
        &key,
        vgs_instructions,
        INSTRUCTION_SPECS_COUNT,
        sizeof(vgs_instructions[0]),
        vgs_comp_instruction_spec
    );
}

struct VGSParser {
    const char* source;
    size_t cursor;
};

struct VGSParserToken {
    enum {
        TOKEN_COMMENT,
        TOKEN_EOF,
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

// Return the next token in the source.
//
// @param[out]  token     Next token.
// @param[in]   advance   If true, the parser cursor is updated after
//                        the returned token.
//
// @return `0` on success, a negative `AVERROR` code on failure.
static int vgs_parser_next_token(
    struct DrawVGContext *ctx,
    struct VGSParser *parser,
    struct VGSParserToken *token,
    int advance
) {

#define WORD_SEPARATOR " \n\t\r,"

    int level;
    size_t cursor, length;
    const char *source = &parser->source[parser->cursor];

    cursor = strspn(source, WORD_SEPARATOR);
    token->position = parser->cursor + cursor;
    token->lexeme = &source[cursor];

    switch (source[cursor]) {
    case '\0':
        token->type = TOKEN_EOF;
        token->length = 0;
        break;

    case '(':
        // Find matching parenthesis.
        level = 1;
        length = 1;

        while (level > 0) {
            switch (source[cursor + length]) {
            case '\0':
                av_log(ctx, AV_LOG_ERROR, "unclosed '(' at position %zu\n", token->position);
                return -1;

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
        // Return a comment if the next character is also '/',
        // and a word if not.
        if (source[cursor + 1] == '/') {
            token->type = TOKEN_COMMENT;
            token->length = strcspn(token->lexeme, "\n");
            break;
        }

        /* fallthrough */

    default:
        token->type = TOKEN_WORD;
        token->length = strcspn(token->lexeme, WORD_SEPARATOR);
        break;
    }

    if (advance)
        parser->cursor += cursor + token->length;

    return 0;
}

static int vgs_parser_next_token_is_numeric(
    struct DrawVGContext *ctx,
    struct VGSParser *parser
) {
    struct VGSParserToken token;
    return vgs_parser_next_token(ctx, parser, &token, 0) == 0
        && (token.type == TOKEN_EXPR || token.type == TOKEN_LITERAL);
}

// Release the memory allocated by the program.
static void vgs_free(struct VGSProgram *program) {
    if (program->statements == NULL)
        return;

    for (int i = 0; i < program->statements_count; i++) {
        struct VGSStatement *s = &program->statements[i];
        if (s->args_count > 0) {
            for (int j = 0; j < s->args_count; j++) {
                switch (s->args[j].type) {
                case SA_AV_EXPR:
                    av_expr_free(s->args[j].expr);
                    break;

                case SA_SUBPROGRAM:
                    vgs_free(s->args[j].subprogram);
                    av_freep(&s->args[j].subprogram);
                    break;
                }
            }

            av_freep(&s->args);
        }
    }

    av_freep(&program->statements);
}

static int vgs_parse_numeric_argument(
    struct DrawVGContext *ctx,
    struct VGSParser *parser,
    struct VGSArgument *arg
) {
    int ret;
    char buf[128];
    char *lexeme, *endp;
    struct VGSParserToken token;

    ret = vgs_parser_next_token(ctx, parser, &token, 1);
    if (ret != 0)
        return ret;

    // Convert the lexeme to a NUL-terminated string.
    if (token.length < sizeof(buf))
        lexeme = buf;
    else
        lexeme = av_malloc(token.length + 1);

    memcpy(lexeme, token.lexeme, token.length);
    lexeme[token.length] = '\0';

    switch (token.type) {
    case TOKEN_LITERAL:
        arg->type = SA_LITERAL;
        arg->literal = strtod(buf, &endp);

        if (*endp != '\0') {
            av_log(ctx, AV_LOG_ERROR, "invalid number '%.*s' at position %zu\n",
                (int)token.length, token.lexeme, token.position);

            ret = AVERROR(EINVAL);
        }
        break;

    case TOKEN_EXPR:
        arg->type = SA_AV_EXPR;
        ret = av_expr_parse(
            &arg->expr,
            lexeme,
            var_names,
            vgs_func1_names,
            vgs_func1_impls,
            NULL,
            NULL,
            0,
            ctx
        );
        break;

    default:
        av_log(ctx, AV_LOG_ERROR, "expected numeric argument at position %zu\n",
            token.position);
        ret = AVERROR(EINVAL);
    }

    if (lexeme != buf)
        av_freep(&lexeme);

    if (ret != 0)
        memset(arg, 0, sizeof(*arg));

    return ret;
}

static int vgs_parse(
    struct DrawVGContext *ctx,
    const char *source,
    struct VGSProgram *program,
    size_t *subprogram_end
);

// Extract the arguments for an instruction, and add a new statement
// to the program.
static int vgs_parse_statement(
    struct DrawVGContext *ctx,
    struct VGSParser *parser,
    struct VGSProgram *program,
    struct VGSInstructionSpec *spec
) {
    int ret;

    struct VGSParserToken token;

    struct VGSStatement statement = {
        .inst = spec->inst,
        .inst_name = spec->name,
        .args = NULL,
        .args_count = 0,
    };

#define ADD_ARG(arg) \
    do {                            \
        void *r = av_dynarray2_add( \
            (void*)&statement.args, \
            &statement.args_count,  \
            sizeof(arg),            \
            (void*)&arg             \
        );                          \
                                    \
        if (r == NULL)              \
            goto fail;              \
    } while(0)

#define ADD_STATEMENT() \
    do {                                 \
        void *r = av_dynarray2_add(      \
            (void*)&program->statements, \
            &program->statements_count,  \
            sizeof(statement),           \
            (void*)&statement            \
        );                               \
                                         \
        if (r == NULL)                   \
            goto fail;                   \
                                         \
        statement.args = NULL;           \
        statement.args_count = 0;        \
    } while(0)

    switch (spec->params.type) {
    case PARAMS_NONE:
        ADD_STATEMENT();
        return 0;

    case PARAMS_NUMBERS:
    case PARAMS_NUMBERS_SEQS:
        do {
            while (statement.args_count < spec->params.num) {
                struct VGSArgument arg;
                ret = vgs_parse_numeric_argument(ctx, parser, &arg);

                if (ret != 0)
                    goto fail;

                ADD_ARG(arg);
            }

            ADD_STATEMENT();
        } while(
            // Repeat this instruction with another set if the next
            // token is numeric.
            spec->params.type == PARAMS_NUMBERS_SEQS
                && vgs_parser_next_token_is_numeric(ctx, parser)
        );

        return 0;

    case PARAMS_CONSTANT:
        ret = vgs_parser_next_token(ctx, parser, &token, 1);
        if (ret != 0)
            goto fail;

        for (
            const struct VGSConstant *c = spec->params.consts;
            c->name != NULL;
            c++
        ) {
            if (
                strncmp(token.lexeme, c->name, token.length) == 0
                    && token.length == strlen(c->name)
            ) {
                struct VGSArgument arg = {
                    .type = SA_CONST,
                    .constant = c->value,
                };

                ADD_ARG(arg);
                ADD_STATEMENT();
                return 0;
            }
        }

        av_log(ctx, AV_LOG_ERROR, "invalid argument '%.*s' at position %zu\n",
            (int)token.length, token.lexeme, token.position);

        goto fail;

    case PARAMS_COLORS:
        while (statement.args_count < spec->params.num) {
            struct VGSArgument arg = {
                .type = SA_COLOR,
                .color = { 0 },
            };

            ret = vgs_parser_next_token(ctx, parser, &token, 1);
            if (ret != 0)
                goto fail;

            ret = av_parse_color(arg.color, token.lexeme, token.length, ctx);
            if (ret != 0) {
                av_log(ctx, AV_LOG_ERROR, "expected a color at position %zu\n", token.position);
                goto fail;
            }

            ADD_ARG(arg);
        }

        ADD_STATEMENT();
        return 0;

    case PARAMS_NUMBER_COLOR:
        do {
            struct VGSArgument arg0;
            struct VGSArgument arg1;

            // First argument must be a numeric value.
            ret = vgs_parse_numeric_argument(ctx, parser, &arg0);
            if (ret != 0)
                goto fail;

            // Second argument must be a color.
            ret = vgs_parser_next_token(ctx, parser, &token, 1);
            if (ret != 0)
                goto fail;

            arg1.type = SA_COLOR,
            ret = av_parse_color(arg1.color, token.lexeme, token.length, ctx);
            if (ret != 0) {
                av_log(ctx, AV_LOG_ERROR, "expected a color at position %zu\n", token.position);
                goto fail;
            }

            ADD_ARG(arg0);
            ADD_ARG(arg1);
            ADD_STATEMENT();
        } while(
            // Repeat the instruction if `num == 1`, and the next
            // token is numeric.
            spec->params.num == 1
                && vgs_parser_next_token_is_numeric(ctx, parser)
        );

        return 0;

    case PARAMS_SUBPROGRAM:
        // First, the numeric arguments.
        while (statement.args_count < spec->params.num) {
            struct VGSArgument arg;
            ret = vgs_parse_numeric_argument(ctx, parser, &arg);

            if (ret != 0)
                goto fail;

            ADD_ARG(arg);
        }

        // Then, the subprogram.
        ret = vgs_parser_next_token(ctx, parser, &token, 1);
        if (ret != 0)
            goto fail;

        if (token.type == TOKEN_LEFT_BRACKET) {
            struct VGSArgument arg = {
                .type = SA_SUBPROGRAM,
                .subprogram = av_mallocz(sizeof(struct VGSProgram)),
            };

            ret = vgs_parse(ctx, token.lexeme + token.length, arg.subprogram, &parser->cursor);
            if (ret != 0) {
                av_freep(&arg.subprogram);
                goto fail;
            }

            ADD_ARG(arg);
            ADD_STATEMENT();
            return 0;
        }

        av_log(ctx, AV_LOG_ERROR, "expected '{', found '%.*s' at position %zu\n",
            (int)token.length, token.lexeme, token.position);
        goto fail;
    }

#undef ADD_ARG
#undef ADD_STATEMENT

fail:
    if (statement.args != NULL) {
        statement.args_count = 0;
        av_freep(&statement.args);
    }

    return AVERROR(EINVAL);
}

// Parse a script to generate the program statements.
//
// @return `0` on success, a negative `AVERROR` code on failure.
static int vgs_parse(
    struct DrawVGContext *ctx,
    const char *source,
    struct VGSProgram *program,
    size_t *subprogram_end
) {
    struct VGSParserToken token;

    struct VGSParser parser = {
        .source = source,
        .cursor = 0,
    };

    program->statements = NULL;
    program->statements_count = 0;

    for (;;) {
        int ret;
        struct VGSInstructionSpec *inst;

        ret = vgs_parser_next_token(ctx, &parser, &token, 1);
        if (ret != 0)
            goto fail;

        switch (token.type) {
        case TOKEN_COMMENT:
            break;

        case TOKEN_EOF:
            return 0;

        case TOKEN_WORD:
            // The token must be a valid instruction.
            inst = vgs_get_instruction(token.lexeme, token.length);
            if (inst == NULL)
                goto invalid_token;

            ret = vgs_parse_statement(ctx, &parser, program, inst);
            if (ret != 0)
                goto fail;

            break;

        case TOKEN_RIGHT_BRACKET:
            // A '}' is accepted only if we are parsing a subprogram.
            if (subprogram_end == NULL)
                goto invalid_token;

            *subprogram_end += token.position + 1;
            return 0;

        default:
            goto invalid_token;
        }
    }

    return 0;

invalid_token:
    av_log(ctx, AV_LOG_ERROR, "Invalid token at position %zu: '%.*s'\n",
        token.position, (int)token.length, token.lexeme);

fail:
    vgs_free(program);
    return AVERROR(EINVAL);
}

struct VGSValueStackEntry {
    struct VGSValueStackEntry *next;
    double key;
    double value;
};

struct VGSEvalState {
    void *log_ctx;

    cairo_t *cairo_ctx;
    cairo_pattern_t *pattern_builder;

    int interrupted;

    double vars[VAR_COUNT];
    struct VGSValueStackEntry *stack_values;

    // Track reflected control points from previous curve operation,
    // for T and S instructions.
    //
    // https://www.w3.org/TR/SVG/paths.html#ReflectedControlPoints
    struct {
        enum { RCP_NONE, RCP_VALID, RCP_UPDATED } status;

        double cubic_x;
        double cubic_y;
        double quad_x;
        double quad_y;
    } rcp;
};

static void vgs_stack_value_free(struct VGSEvalState *state) {
    struct VGSValueStackEntry *next, *entry = state->stack_values;
    while (entry != NULL) {
        next = entry->next;
        av_freep(&entry);
        entry = next;
    }
}

static void vgs_stack_value_put(struct VGSEvalState *state, double key, double value) {
    struct VGSValueStackEntry *entry;

    if (isnan(key) || isinf(key) || isnan(value))
        return;

    entry = av_mallocz(sizeof(struct VGSValueStackEntry));
    entry->next = state->stack_values;
    entry->key = key;
    entry->value = value;
    state->stack_values = entry;
}

static double vgs_stack_value_get(struct VGSEvalState *state, double key, int pop) {
    struct VGSValueStackEntry **entry = &state->stack_values;

    while (*entry != NULL) {
        if ((*entry)->key == key) {
            double value = (*entry)->value;

            if (pop) {
                struct VGSValueStackEntry *old = *entry;
                *entry = (*entry)->next;
                av_freep(&old);
            }

            return value;
        }

        entry = &(*entry)->next;
    }

    return NAN;
}

static double vgs_fn_peek(void *data, double arg) {
    struct VGSEvalState *state = (struct VGSEvalState *)data;
    return vgs_stack_value_get(state, arg, 0);
}

static double vgs_fn_pop(void *data, double arg) {
    struct VGSEvalState *state = (struct VGSEvalState *)data;
    return vgs_stack_value_get(state, arg, 1);
}

static void vgs_eval_state_init(struct VGSEvalState *state, void *log_ctx) {
    memset(state, 0, sizeof(*state));

    state->log_ctx = log_ctx;
    state->rcp.status = RCP_NONE;

    for (int i = 0; i < VAR_COUNT; i++)
        state->vars[i] = NAN;
}

static void vgs_eval_state_free(struct VGSEvalState *state) {
    if (state->pattern_builder != NULL)
        cairo_pattern_destroy(state->pattern_builder);

    vgs_stack_value_free(state);

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
    cairo_new_sub_path(c);
}

// Execute the cairo functions for the given script.
static int vgs_eval(
    struct VGSEvalState *state,
    const struct VGSProgram *program
) {
#define ASSERT_ARGS(n) \
    do {                                                    \
        if (statement->args_count != n) {                   \
            /* This is a bug in the parser */               \
            av_log(state->log_ctx, AV_LOG_ERROR,            \
                "Instruction '%s' expects %d arguments.\n", \
                statement->inst_name, n                     \
            );                                              \
            return 0;                                       \
        }                                                   \
    } while(0);

    double cx, cy; // Current point.

    int relative;

    union {
        double d;
        int i;
        const uint8_t *c;
        const struct VGSProgram *p;
    } args[8];

    for (int st_number = 0; st_number < program->statements_count; st_number++) {
        struct VGSStatement *statement = &program->statements[st_number];

        if (statement->args_count >= FF_ARRAY_ELEMS(args)) {
            av_log(state->log_ctx, AV_LOG_ERROR, "Too many arguments (%d).", statement->args_count);
            return AVERROR(E2BIG);
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
            const struct VGSArgument *a = &statement->args[arg];
            switch (a->type) {
            case SA_CONST:
                args[arg].i = a->constant;
                break;

            case SA_LITERAL:
                args[arg].d = a->literal;
                break;

            case SA_AV_EXPR:
                args[arg].d = av_expr_eval(a->expr, state->vars, state);
                break;

            case SA_COLOR:
                args[arg].c = a->color;
                break;

            case SA_SUBPROGRAM:
                args[arg].p = a->subprogram;
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
                args[0].d,
                args[1].d,
                args[2].d,
                args[3].d,
                args[4].d
            );
            break;

        case INS_ARC_NEG:
            ASSERT_ARGS(5);
            cairo_arc_negative(
                state->cairo_ctx,
                args[0].d,
                args[1].d,
                args[2].d,
                args[3].d,
                args[4].d
            );
            break;

        case INS_CIRCLE:
            ASSERT_ARGS(3);
            draw_ellipse(state->cairo_ctx, args[0].d, args[1].d, args[2].d, args[2].d);
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

            cairo_clip(state->cairo_ctx);
            break;

        case INS_CLOSE_PATH:
            ASSERT_ARGS(0);
            cairo_close_path(state->cairo_ctx);
            break;

        case INS_COLOR_STOP:
            if (state->pattern_builder == NULL) {
                av_log(state->log_ctx, AV_LOG_ERROR, "colorstop with no gradient.\n");
                break;
            }

            ASSERT_ARGS(2);
            cairo_pattern_add_color_stop_rgba(
                state->pattern_builder,
                args[0].d,
                args[1].c[0] / 255.0,
                args[1].c[1] / 255.0,
                args[1].c[2] / 255.0,
                args[1].c[3] / 255.0
            );
            break;

        case INS_CURVE_TO:
        case INS_CURVE_TO_REL:
            ASSERT_ARGS(6);
            cubic_curve_to(
                state,
                statement->inst == INS_CURVE_TO_REL,
                args[0].d,
                args[1].d,
                args[2].d,
                args[3].d,
                args[4].d,
                args[5].d
            );
            break;

        case INS_ELLIPSE:
            ASSERT_ARGS(4);
            draw_ellipse(state->cairo_ctx, args[0].d, args[1].d, args[2].d, args[3].d);
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

            cairo_fill_preserve(state->cairo_ctx);
            break;

        case INS_FINISH:
            state->interrupted = 1;
            return 0;

        case INS_IF:
            ASSERT_ARGS(2);
            if (args[0].d != 0.0) {
                int ret = vgs_eval(state, args[1].p);
                if (ret != 0 || state->interrupted != 0)
                    return ret;
            }

            break;

        case INS_LINEAR_GRAD:
            ASSERT_ARGS(4);

            if (state->pattern_builder != NULL)
                cairo_pattern_destroy(state->pattern_builder);

            state->pattern_builder = cairo_pattern_create_linear(
                args[0].d,
                args[1].d,
                args[2].d,
                args[3].d
            );
            break;

        case INS_LINE_TO:
            ASSERT_ARGS(2);
            cairo_line_to(state->cairo_ctx, args[0].d, args[1].d);
            break;

        case INS_LINE_TO_REL:
            ASSERT_ARGS(2);
            cairo_rel_line_to(state->cairo_ctx, args[0].d, args[1].d);
            break;

        case INS_MOVE_TO:
            ASSERT_ARGS(2);
            cairo_move_to(state->cairo_ctx, args[0].d, args[1].d);
            break;

        case INS_MOVE_TO_REL:
            ASSERT_ARGS(2);
            cairo_rel_move_to(state->cairo_ctx, args[0].d, args[1].d);
            break;

        case INS_NEW_PATH:
            ASSERT_ARGS(0);
            cairo_new_path(state->cairo_ctx);
            break;

        case INS_PUSH:
            ASSERT_ARGS(2);
            vgs_stack_value_put(state, args[0].d, args[1].d);
            break;

        case INS_Q_CURVE_TO:
        case INS_Q_CURVE_TO_REL:
            ASSERT_ARGS(4);
            relative = statement->inst == INS_Q_CURVE_TO_REL;
            quad_curve_to(state, relative, args[0].d, args[1].d, args[2].d, args[3].d);
            break;

        case INS_RADIAL_GRAD:
            ASSERT_ARGS(6);

            if (state->pattern_builder != NULL)
                cairo_pattern_destroy(state->pattern_builder);

            state->pattern_builder = cairo_pattern_create_radial(
                args[0].d,
                args[1].d,
                args[2].d,
                args[3].d,
                args[4].d,
                args[5].d
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
            cairo_rectangle(state->cairo_ctx, args[0].d, args[1].d, args[2].d, args[3].d);
            break;

        case INS_REPEAT:
            ASSERT_ARGS(2);
            for (int i = 0, count = (int)args[0].d; i < count; i++) {
                int ret;

                state->vars[VAR_I] = i;
                ret = vgs_eval(state, args[1].p);
                if (ret != 0)
                    return ret;

                // Ensure `interrupted` is reset after `repeat`, since
                // it can be used to stop a loop.
                state->interrupted = 0;
            }

            state->vars[VAR_I] = NAN;
            break;

        case INS_RESTORE:
            ASSERT_ARGS(0);
            cairo_restore(state->cairo_ctx);
            break;

        case INS_ROTATE:
            ASSERT_ARGS(1);
            cairo_rotate(state->cairo_ctx, args[0].d);
            break;

        case INS_ROUNDEDRECT:
            ASSERT_ARGS(5);
            rounded_rect(state->cairo_ctx, args[0].d, args[1].d, args[2].d, args[3].d, args[4].d);
            break;

        case INS_SAVE:
            ASSERT_ARGS(0);
            cairo_save(state->cairo_ctx);
            break;

        case INS_SCALE:
            ASSERT_ARGS(1);
            cairo_scale(state->cairo_ctx, args[0].d, args[0].d);
            break;

        case INS_SCALEXY:
            ASSERT_ARGS(2);
            cairo_scale(state->cairo_ctx, args[0].d, args[1].d);
            break;

        case INS_SETCOLOR:
            ASSERT_ARGS(1);

            if (state->pattern_builder != NULL)
                cairo_pattern_destroy(state->pattern_builder);

            state->pattern_builder = cairo_pattern_create_rgba(
                args[0].c[0] / 255.0,
                args[0].c[1] / 255.0,
                args[0].c[2] / 255.0,
                args[0].c[3] / 255.0
            );
            break;

        case INS_SETLINECAP:
            ASSERT_ARGS(1);
            cairo_set_line_cap(state->cairo_ctx, args[0].i);
            break;

        case INS_SETLINEJOIN:
            ASSERT_ARGS(1);
            cairo_set_line_join(state->cairo_ctx, args[0].i);
            break;

        case INS_SETLINEWIDTH:
            ASSERT_ARGS(1);
            cairo_set_line_width(state->cairo_ctx, args[0].d);
            break;

        case INS_SET_DASH:
            ASSERT_ARGS(1);

            {
                int num;
                double *dashes, dbuf[16];

                num = cairo_get_dash_count(state->cairo_ctx);

                if (num + 1 < FF_ARRAY_ELEMS(dbuf))
                    dashes = dbuf;
                else
                    dashes = av_calloc(num + 1, sizeof(double));

                cairo_get_dash(state->cairo_ctx, dashes, NULL);
                dashes[num] = args[0].d;
                cairo_set_dash(state->cairo_ctx, dashes, num + 1, 0);

                if (dashes != dbuf)
                    av_freep(&dashes);
            }
            break;

        case INS_STROKE:
            ASSERT_ARGS(0);
            cairo_stroke_preserve(state->cairo_ctx);
            break;

        case INS_S_CURVE_TO:
        case INS_S_CURVE_TO_REL:
            ASSERT_ARGS(4);
            relative = statement->inst == INS_S_CURVE_TO_REL;
            cubic_curve_to(state, relative, NAN, NAN, args[0].d, args[1].d, args[2].d, args[3].d);
            break;

        case INS_TRANSLATE:
            ASSERT_ARGS(2);
            cairo_translate(state->cairo_ctx, args[0].d, args[1].d);
            break;

        case INS_T_CURVE_TO:
        case INS_T_CURVE_TO_REL:
            ASSERT_ARGS(2);
            relative = statement->inst == INS_T_CURVE_TO_REL;
            quad_curve_to(state, relative, NAN, NAN, args[0].d, args[1].d);
            break;

        case INS_HORZ:
        case INS_HORZ_REL:
        case INS_VERT:
        case INS_VERT_REL:
            ASSERT_ARGS(1);

            if (cairo_has_current_point(state->cairo_ctx)) {
                double d = args[0].d;

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

        // Discard reflected points if the last instruction did not
        // set new points.
        if (state->rcp.status == RCP_UPDATED)
            state->rcp.status = RCP_VALID;
        else
            state->rcp.status = RCP_NONE;
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
    AV_PIX_FMT_BGRA,
    AV_PIX_FMT_BGR0,
    AV_PIX_FMT_RGB565LE,
    AV_PIX_FMT_X2RGB10LE,
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
    vgs_eval_state_init(&eval_state, drawvg_ctx);

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
    eval_state.vars[VAR_I] = NAN;
    eval_state.vars[VAR_DURATION] = frame->duration * av_q2d(inlink->time_base);

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
    DrawVGContext *drawvg = ctx->priv;

    if (drawvg->script_file != NULL) {
        int ret = ff_load_textfile(
            ctx,
            (const char *)drawvg->script_file,
            &drawvg->script_text,
            NULL
        );

        if (ret != 0)
            return ret;
    }

    return vgs_parse(drawvg, drawvg->script_text, &drawvg->program, NULL);
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

const AVFilter ff_vf_drawvg = {
    .name        = "drawvg",
    .description = NULL_IF_CONFIG_SMALL("Draw vector graphics on top of video frames."),
    .flags       = AVFILTER_FLAG_METADATA_ONLY,
    .priv_size   = sizeof(DrawVGContext),
    .priv_class  = &drawvg_class,
    .init        = drawvg_init,
    .uninit      = drawvg_uninit,
    FILTER_INPUTS(drawvg_inputs),
    FILTER_OUTPUTS(ff_video_default_filterpad),
    FILTER_PIXFMTS_ARRAY(drawvg_pix_fmts),
};
