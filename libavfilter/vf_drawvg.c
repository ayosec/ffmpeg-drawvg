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
#include "video.h"

struct DrawVGContext;

enum ScriptInstruction {
    CMD_LINETO = 1,
    CMD_MOVETO,
    CMD_REL_LINETO,
    CMD_REL_MOVETO,
    CMD_SAVE,
    CMD_SETLINECAP,
    CMD_SETLINEJOIN,
    CMD_STROKE,
};

// Instruction arguments.
struct ScriptArgument {
    enum {
        SA_CONST = 1,
        SA_LITERAL,
        SA_AV_EXPR,
    } type;

    union {
        int constant;
        double literal;
        AVExpr *expr;
    };
};

// Script statements.
struct ScriptStatement {
    enum ScriptInstruction inst;
    struct ScriptArgument *args;
    int args_count;
};

struct Script {
    struct ScriptStatement *statements;
    int statements_count;
};

// Constants used in some draw instructions, like `setlinejoin`.
struct ScriptConstant {
    const char* name;
    int value;
};

static struct ScriptConstant consts_line_cap[] = {
    { "butt", CAIRO_LINE_CAP_BUTT },
    { "round", CAIRO_LINE_CAP_ROUND },
    { "square", CAIRO_LINE_CAP_SQUARE },
    { 0, 0 },
};

static struct ScriptConstant consts_line_join[] = {
    { "bevel", CAIRO_LINE_JOIN_BEVEL },
    { "miter", CAIRO_LINE_JOIN_MITER },
    { "round", CAIRO_LINE_JOIN_ROUND },
    { 0, 0 },
};

// Syntax of the instruction arguments.
struct ScriptArgumentSyntax {
    enum {
        // The instruction does not expect any argument.
        ARG_SYNTAX_NONE = 1,

        // The instruction expects a sequence of sets. The parser emits an
        // instruction for each complete set.
        //
        // The field `num` must indicate the size of the set.
        //
        // For example, the instruction `L` expects 2 arguments in each set,
        // so the script `L 10 10 20 20` emit two `lineto` instructions:
        // `L 10 20` and `L 20 20`.
        ARG_SYNTAX_SETS,

        // The instruction expects a single argument, which is a keyword
        // from the array in the field `const_names`.
        ARG_SYNTAX_CONST,
    } type;

    union {
        int num;
        const struct ScriptConstant *consts;
    };
};

struct ScriptInstructionSpec {
    enum ScriptInstruction inst;
    const char* name;
    struct ScriptArgumentSyntax syntax;
};

// Instructions available to the scripts.
//
// The array must be sorted in ascending order by `name`.
struct ScriptInstructionSpec instruction_specs[] = {
    { CMD_LINETO,      "L",           { ARG_SYNTAX_SETS, { .num = 2 } } },
    { CMD_MOVETO,      "M",           { ARG_SYNTAX_SETS, { .num = 2 } } },
    { CMD_REL_LINETO,  "l",           { ARG_SYNTAX_SETS, { .num = 2 } } },
    { CMD_LINETO,      "lineto",      { ARG_SYNTAX_SETS, { .num = 2 } } },
    { CMD_REL_MOVETO,  "m",           { ARG_SYNTAX_SETS, { .num = 2 } } },
    { CMD_MOVETO,      "moveto",      { ARG_SYNTAX_SETS, { .num = 2 } } },
    { CMD_REL_LINETO,  "rlineto",     { ARG_SYNTAX_SETS, { .num = 2 } } },
    { CMD_REL_MOVETO,  "rmoveto",     { ARG_SYNTAX_SETS, { .num = 2 } } },
    { CMD_SAVE,        "save",        { ARG_SYNTAX_NONE } },
    { CMD_SETLINECAP,  "setlinecap",  { ARG_SYNTAX_CONST, { .consts = consts_line_cap } } },
    { CMD_SETLINEJOIN, "setlinejoin", { ARG_SYNTAX_CONST, { .consts = consts_line_join } } },
    { CMD_STROKE,      "stroke",      { ARG_SYNTAX_NONE } },
};

#define INSTRUCTION_SPECS_COUNT FF_ARRAY_ELEMS(instruction_specs)

// Comparator for `ScriptInstructionSpec`, to be used with `bsearch(3)`.
static int comparator_instruction_spec(const void *cs1, const void *cs2) {
    return strcmp(
        ((struct ScriptInstructionSpec*)cs1)->name,
        ((struct ScriptInstructionSpec*)cs2)->name
    );
}

// Return the specs for the given instruction, or `NULL` if the name is not valid.
static struct ScriptInstructionSpec* script_get_instruction(const char *name, size_t length) {
    char bufname[64];
    struct ScriptInstructionSpec key = { .name = bufname };

    if (length >= sizeof(bufname)) {
        return NULL;
    }

    memcpy(bufname, name, length);
    bufname[length] = '\0';

    return bsearch(
        &key,
        instruction_specs,
        INSTRUCTION_SPECS_COUNT,
        sizeof(instruction_specs[0]),
        comparator_instruction_spec
    );
}

struct ScriptParser {
    const char* source;
    size_t cursor;
};

struct ScriptParserToken {
    enum {
        TOKEN_EOF,
        TOKEN_EXPR,
        TOKEN_LITERAL,
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
static int script_parser_scan(
    struct DrawVGContext *ctx,
    struct ScriptParser *parser,
    struct ScriptParserToken *token,
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

    case '-':
    case '+':
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

// Release the memory allocated by the script.
static void script_free(struct Script *script) {
    if (script->statements == NULL) {
        return;
    }

    for (int i = 0; i < script->statements_count; i++) {
        struct ScriptStatement *s = &script->statements[i];
        if (s->args_count > 0) {
            for (int j = 0; j < s->args_count; j++) {
                if (s->args[j].type == SA_AV_EXPR) {
                    av_expr_free(s->args[j].expr);
                }
            }

            av_freep(&s->args);
        }
    }

    av_freep(&script->statements);
}

static int parse_literal(struct ScriptParserToken *token, double *out) {
    char buf[128];
    char *endptr;

    *out = FP_NAN;

    if (token->length >= sizeof(buf)) {
        return -1;
    }

    memcpy(buf, token->lexeme, token->length);
    buf[token->length] = '\0';

    *out = strtod(buf, &endptr);
    return *endptr == '\0' ? 0 : - 1;
}

// Extract the arguments for an instruction, and add a new statement
// to the script.
static int script_parse_statement(
    struct DrawVGContext *ctx,
    struct ScriptParser *parser,
    struct Script *script,
    struct ScriptInstructionSpec *spec
) {
    int ret;
    char *slice;
    struct ScriptParserToken token;

    struct ScriptStatement statement = {
        .inst = spec->inst,
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
        if (r == NULL) {            \
            goto fail;              \
        }                           \
    } while(0)

#define ADD_STATEMENT() \
    do {                                \
        void *r = av_dynarray2_add(     \
            (void*)&script->statements, \
            &script->statements_count,  \
            sizeof(statement),          \
            (void*)&statement           \
        );                              \
                                        \
        if (r == NULL) {                \
            goto fail;                  \
        }                               \
    } while(0)

    switch (spec->syntax.type) {
        case ARG_SYNTAX_NONE:
            ADD_STATEMENT();
            return 0;

        case ARG_SYNTAX_SETS:
add_set:
            while (statement.args_count < spec->syntax.num) {
                struct ScriptArgument arg;

                ret = script_parser_scan(ctx, parser, &token, 1);
                if (ret != 0) {
                    goto fail;
                }

                switch (token.type) {
                    case TOKEN_LITERAL:
                        ret = parse_literal(&token, &arg.literal);
                        if (ret != 0) {
                            goto fail;
                        }

                        arg.type = SA_LITERAL;
                        ADD_ARG(arg);
                        break;

                    case TOKEN_EXPR:
                        slice = av_memdup(token.lexeme, token.length + 1);
                        slice[token.length] = '\0';

                        ret = av_expr_parse(
                            &arg.expr,
                            slice,
                            NULL, // TODO
                            NULL,
                            NULL,
                            NULL,
                            NULL,
                            0, // ??
                            ctx
                        );

                        av_freep(&slice);

                        if (ret != 0) {
                            goto fail;
                        }

                        arg.type = SA_AV_EXPR;
                        ADD_ARG(arg);

                        break;

                    default:
                        av_log(ctx, AV_LOG_ERROR, "expected numeric argument at position %zu\n",
                            token.position);
                        goto fail;
                }
            }

            ADD_STATEMENT();

            // Add a new set if the next token is numeric.
            if (
                script_parser_scan(ctx, parser, &token, 0) == 0
                && (token.type == TOKEN_EXPR || token.type == TOKEN_LITERAL)
            ) {
                statement.args = NULL;
                statement.args_count = 0;
                goto add_set;
            }

            return 0;

        case ARG_SYNTAX_CONST:
            ret = script_parser_scan(ctx, parser, &token, 1);
            if (ret != 0) {
                goto fail;
            }

            for (const struct ScriptConstant *c = spec->syntax.consts; c->name != NULL; c++) {
                if (
                    strncmp(token.lexeme, c->name, token.length) == 0
                    && token.length == strlen(c->name)
                ) {
                    struct ScriptArgument arg = {
                        .type = SA_CONST,
                        .constant = c->value,
                    };

                    ADD_ARG(arg);
                    ADD_STATEMENT();
                    return 0;
                }
            }

            goto fail;
    }

#undef ADD_ARG
#undef ADD_STATEMENT

fail:
    if (statement.args != NULL) {
        av_freep(&statement.args);
    }

    return AVERROR(EINVAL);
}

// Parse a script and write the instructions to the `script` argument.
//
// @param[in]  source   Script source.
// @param[out] script   Parsed script.
//
// @return `0` on success, a negative `AVERROR` code on failure.
static int script_parse(
    struct DrawVGContext *ctx,
    const char *source,
    struct Script *script
) {
    struct ScriptParser parser = {
        .source = source,
        .cursor = 0,
    };

    script->statements = NULL;
    script->statements_count = 0;

    for(;;) {
        int ret;
        struct ScriptParserToken token;

        ret = script_parser_scan(ctx, &parser, &token, 1);
        if (ret != 0) {
            goto fail;
        }

        if (token.type == TOKEN_EOF) {
            break;
        }

        if (token.type == TOKEN_WORD) {
            // Expect a valid instruction.
            struct ScriptInstructionSpec *inst = script_get_instruction(token.lexeme, token.length);
            if (inst != NULL) {
                ret = script_parse_statement(ctx, &parser, script, inst);
                if (ret != 0) {
                    goto fail;
                }

                continue;
            }
        }

        av_log(ctx, AV_LOG_ERROR, "Invalid token at position %zu: %.*s\n",
            token.position, (int)token.length, token.lexeme);

        goto fail;
    }

    return 0;

fail:
    script_free(script);
    return AVERROR(EINVAL);
}



typedef struct DrawVGContext {
    const AVClass *class;

    cairo_format_t cairo_format;     ///< equivalent to AVPixelFormat

    uint8_t *script_source;
    struct Script script;
} DrawVGContext;

#define OFFSET(x) offsetof(DrawVGContext, x)

#define FLAGS AV_OPT_FLAG_FILTERING_PARAM | AV_OPT_FLAG_VIDEO_PARAM

#define OPT_SCRIPT(name) \
    {                                            \
        name,                                    \
        "script source to render the graphics.", \
        OFFSET(script_source),                   \
        AV_OPT_TYPE_STRING,                      \
        { .str = NULL },                         \
        0, 0,                                    \
        FLAGS                                    \
    }

static const AVOption drawvg_options[]= {
    OPT_SCRIPT("script"),
    OPT_SCRIPT("s"),
    { NULL }
};

#undef OFFSET
#undef FLAGS
#undef OPT_SCRIPT
#undef OPT_ARGN


AVFILTER_DEFINE_CLASS(drawvg);

static const enum AVPixelFormat pixel_fmts_drawvg[] = {
    AV_PIX_FMT_BGRA,
    AV_PIX_FMT_BGR0,
    AV_PIX_FMT_RGB565LE,
    AV_PIX_FMT_X2RGB10LE,
    AV_PIX_FMT_NONE
};

// Return the cairo equivalent to AVPixelFormat.
static cairo_format_t cairo_format_from_pix_fmt(DrawVGContext* ctx, enum AVPixelFormat format) {
    // This array must have the same order of `pixel_fmts_drawvg`.
    const cairo_format_t pixel_fmt_map[] = {
        CAIRO_FORMAT_ARGB32, // cairo expects pre-multiplied alpha.
        CAIRO_FORMAT_RGB24,
        CAIRO_FORMAT_RGB16_565,
        CAIRO_FORMAT_RGB30,
        CAIRO_FORMAT_INVALID,
    };

    const char* pix_fmt_name = av_get_pix_fmt_name(format);

    for (int i = 0; pixel_fmts_drawvg[i] != AV_PIX_FMT_NONE; i++) {
        if (pixel_fmts_drawvg[i] == format) {
            cairo_format_t fmt = pixel_fmt_map[i];

            av_log(ctx, AV_LOG_TRACE, "Use cairo_format_t#%d for %s\n",
                fmt, pix_fmt_name);

            return fmt;
        }
    }

    av_log(ctx, AV_LOG_ERROR, "Invalid pix_fmt: %s\n", pix_fmt_name);
    return CAIRO_FORMAT_INVALID;
}

static int drawvg_filter_frame(AVFilterLink *inlink, AVFrame *frame) {
    cairo_surface_t* surface;
    cairo_t *cr;

    /*FilterLink *inl = ff_filter_link(inlink);*/
    AVFilterLink *outlink = inlink->dst->outputs[0];
    AVFilterContext *filter_ctx = inlink->dst;
    DrawVGContext *drawvg_ctx = filter_ctx->priv;

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

    cr = cairo_create(surface);

    // Simple example.
    cairo_save(cr);
    cairo_set_source_rgba(cr, 1, 0, 0, 0.9);
    cairo_set_line_width(cr, 30);
    cairo_translate(cr, frame->width/2, frame->height/2);
    cairo_arc(cr, 0, 0, frame->width/3, 0, 2 * M_PI);
    cairo_stroke(cr);
    cairo_restore(cr);

    cairo_set_line_width(cr, 5);
    cairo_set_source_rgba(cr, 0, 1, 0, 1);
    cairo_translate(cr, 0, frame->height/2);
    cairo_scale(cr, 1, frame->pts / 40.0 + 0.5);
    cairo_set_font_size(cr, frame->width/3);
    cairo_move_to(cr, 0, -frame->width/3);
    cairo_text_path(cr, "xyz");
    cairo_stroke(cr);

    cairo_surface_destroy(surface);

    return ff_filter_frame(outlink, frame);
}

static int drawvg_config_props(AVFilterLink *inlink) {
    const AVPixFmtDescriptor *desc;
    AVFilterContext *filter_ctx = inlink->dst;
    DrawVGContext *drawvg_ctx = filter_ctx->priv;

    // Find the cairo format equivalent to the format of the frame,
    // so cairo can draw directly on the frame data.
    //
    // Cairo is compatible only with packed pixel formats.

    desc = av_pix_fmt_desc_get(inlink->format);
    if (desc->flags & AV_PIX_FMT_FLAG_BITSTREAM == 0) {
        av_log(drawvg_ctx, AV_LOG_ERROR, "Expected packed pixel format, received: %s\n",
            desc->name);
        return AVERROR(EINVAL);
    }

    drawvg_ctx->cairo_format = cairo_format_from_pix_fmt(drawvg_ctx, inlink->format);
    if (drawvg_ctx->cairo_format == CAIRO_FORMAT_INVALID) {
        return AVERROR(EINVAL);
    }

    return 0;
}

static av_cold int drawvg_init(AVFilterContext *ctx) {
    // TODO parse script
    return 0;
}

static av_cold void drawvg_uninit(AVFilterContext *ctx) {
    DrawVGContext *drawvg = ctx->priv;
    script_free(&drawvg->script);
}

static const AVFilterPad drawvg_inputs[] = {
    {
        .name = "default",
        .type = AVMEDIA_TYPE_VIDEO,
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
    FILTER_PIXFMTS_ARRAY(pixel_fmts_drawvg),
};
