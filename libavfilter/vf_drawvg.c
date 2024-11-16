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
 * drawvg filter, draw vector graphics with libcairo.
 */

#include <cairo.h>

#include "libavutil/avassert.h"
#include "libavutil/internal.h"
#include "libavutil/pixdesc.h"
#include "avfilter.h"
#include "filters.h"
#include "video.h"

static const enum AVPixelFormat pixel_fmts_drawvg[] = {
    AV_PIX_FMT_BGRA,
    AV_PIX_FMT_BGR0,
    AV_PIX_FMT_RGB565LE,
    AV_PIX_FMT_X2RGB10LE,
    AV_PIX_FMT_NONE
};

// Return the cairo equivalent to AVPixelFormat.
static cairo_format_t cairo_format_from_pix_fmt(AVFrame *frame) {
    // This array must have the same order of `pixel_fmts_drawvg`.
    static const cairo_format_t pixel_fmt_map[] = {
        CAIRO_FORMAT_ARGB32, // cairo expects pre-multiplied alpha.
        CAIRO_FORMAT_RGB24,
        CAIRO_FORMAT_RGB16_565,
        CAIRO_FORMAT_RGB30,
        CAIRO_FORMAT_INVALID,
    };

    const int format = frame->format;

    for (int i = 0; pixel_fmts_drawvg[i] != AV_PIX_FMT_NONE; i++) {
        if (pixel_fmts_drawvg[i] == format) {
            cairo_format_t fmt = pixel_fmt_map[i];

            av_log(
                NULL,
                AV_LOG_VERBOSE,
                "Use cairo_format_t#%d for %s\n",
                fmt,
                av_get_pix_fmt_name(format)
            );

            return fmt;
        }
    }

    av_log(NULL, AV_LOG_ERROR, "Invalid pix_fmt: %s\n", av_get_pix_fmt_name(format));
    return CAIRO_FORMAT_INVALID;
}

static int filter_frame(AVFilterLink *inlink, AVFrame *frame)
{
    cairo_surface_t* surface;
    cairo_t *cr;

    /*FilterLink *inl = ff_filter_link(inlink);*/
    /*AVFilterContext *ctx = inlink->dst;*/
    AVFilterLink *outlink = inlink->dst->outputs[0];
    /*EQContext *eq = ctx->priv;*/
    AVFrame *out;
    const AVPixFmtDescriptor *desc;

    desc = av_pix_fmt_desc_get(inlink->format);

    if (desc->flags & AV_PIX_FMT_FLAG_BITSTREAM == 0) {
        av_log(NULL, AV_LOG_ERROR, "Expected packed pixel format, received: %s\n", desc->name);
        return AVERROR(EINVAL);
    }

    out = ff_get_video_buffer(outlink, inlink->w, inlink->h);
    if (!out) {
        av_frame_free(&frame);
        return AVERROR(ENOMEM);
    }

    // Draw something with libcairo // TODO: send context for av_log; handle errors
    surface = cairo_image_surface_create_for_data(
        frame->data[0], // Cairo is compatible only with packed formats.
        cairo_format_from_pix_fmt(frame),
        frame->width,
        frame->height,
        frame->linesize[0]
    );

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

static const AVFilterPad drawvg_inputs[] = {
    {
        .name = "default",
        .type = AVMEDIA_TYPE_VIDEO,
        .filter_frame = filter_frame,
        /*.config_props = config_props,*/
    },
};

const AVFilter ff_vf_drawvg = {
    .name        = "drawvg",
    .description = NULL_IF_CONFIG_SMALL("Draw vector graphics on top of video frames."),
    .flags       = AVFILTER_FLAG_METADATA_ONLY,
    FILTER_INPUTS(drawvg_inputs),
    FILTER_OUTPUTS(ff_video_default_filterpad),
    FILTER_PIXFMTS_ARRAY(pixel_fmts_drawvg),
};
