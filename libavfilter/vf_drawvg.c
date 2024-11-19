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
#include "libavutil/eval.h"
#include "libavutil/internal.h"
#include "libavutil/mem.h"
#include "libavutil/opt.h"
#include "libavutil/pixdesc.h"

#include "avfilter.h"
#include "filters.h"
#include "video.h"

#define MAX_ARGS 4

struct DrawVGContext;

// Script Interpreter

struct Tokenizer {
    const char* source;
    size_t cursor;
};

typedef int (*command_eval)(int);

#define MAX_COMMAND_ARGUMENTS 8

struct ScriptCommandArgument {
    enum {
        SCA_CONST = 1,
        SCA_LITERAL,
        SCA_AV_EXPR,
    } tag;

    union {
        int constant;
        double literal;
        AVExpr *expr;
    };
};

struct ScriptCommand {
    struct ScriptCommand *next;
    struct ScriptCommandArgument *arguments;
};

struct Script {
    struct ScriptCommand *command_head;
};

// Constants used in some draw commands, like `setlinejoin`.
struct ConstantName {
    const char* name;
    int value;
};

static struct ConstantName consts_line_cap[] = {
    { "butt", CAIRO_LINE_CAP_BUTT },
    { "round", CAIRO_LINE_CAP_ROUND },
    { "square", CAIRO_LINE_CAP_SQUARE },
    { 0, 0 },
};

static struct ConstantName consts_line_join[] = {
    { "bevel", CAIRO_LINE_JOIN_BEVEL },
    { "miter", CAIRO_LINE_JOIN_MITER },
    { "round", CAIRO_LINE_JOIN_ROUND },
    { 0, 0 },
};

struct ArgumentsParserOptions {
    union {
        struct {
            int size; ///< Size of each set.
        } sets;

        struct {
            const struct ConstantName *names; ///< Array where contants are defined.
        } constants;
    };
};

// Parse sequences of argument sets.
//
// Some commands, like `lineto` or `moveto`, expects a fixed set of
// arguments. This parser emits a command for each set.
//
// For example, the script "L 10 10 20 20" will emit two `lineto`
// commands, equivalent to `L 10 20 L 20 20`.
static int arguments_parser_sets(
    struct DrawVGContext *ctx,
    struct Tokenizer *tokenizer,
    const struct ArgumentsParserOptions *options
) {
    //options->sets.size;
    return 0;
}

// Parse one argument, which must be a constant name.
static int arguments_parser_constant(
    struct DrawVGContext *ctx,
    struct Tokenizer *tokenizer,
    const struct ArgumentsParserOptions *options
) {
    return 0;
}

// drawvg filter.

typedef struct DrawVGContext {
    const AVClass *class;

    cairo_format_t cairo_format;  ///< equivalent to AVPixelFormat

    struct Script script;         ///< script to render on each frame.

    uint8_t *script_source;       ///< render script.
    double args[MAX_ARGS];        ///< values for argN variables.
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

// The min/max for the argN options are restricted to the int range,
// in case we want to convert the variable to int.
#define OPT_ARGN(n) \
    {                                        \
        "arg" #n,                            \
        "value for the arg" #n " variable.", \
        OFFSET(args[n]),                     \
        AV_OPT_TYPE_DOUBLE,                  \
        { .dbl = 0 },                        \
        INT_MIN, INT_MAX,                    \
        FLAGS | AV_OPT_FLAG_RUNTIME_PARAM    \
    }

static const AVOption drawvg_options[]= {
    OPT_SCRIPT("script"),
    OPT_SCRIPT("s"),
    OPT_ARGN(0),
    OPT_ARGN(1),
    OPT_ARGN(2),
    OPT_ARGN(3),
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
    DrawVGContext *drawvg_ctx = ctx->priv;

    // Release memory of the script.
    struct ScriptCommand *node = drawvg_ctx->script.command_head;
    while (node != NULL) {
        struct ScriptCommand *next = node->next;

        av_free(node->arguments);
        av_free(node);

        node = next;
    }
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
