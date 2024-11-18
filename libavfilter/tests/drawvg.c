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

#include <stdio.h>

#include <cairo.h>
#include <cairo-script.h>

#include "libavutil/pixdesc.h"
#include "libavfilter/vf_drawvg.c"

static cairo_status_t write_stdout (
    void *closure,
    const unsigned char *data,
    unsigned int length
) {
    av_assert0(fwrite(data, length, 1, stdout) == 1);
    return CAIRO_STATUS_SUCCESS;
}

int main(void)
{
    cairo_device_t* device;
    cairo_surface_t* surface;
    cairo_t *cr;

    puts("-- running drawvg test: script:\n");

    device = cairo_script_create_for_stream(write_stdout, NULL);
    surface = cairo_script_surface_create(device, CAIRO_CONTENT_COLOR_ALPHA, 320, 240);

    cr = cairo_create(surface);

    // Simple example.
    cairo_save(cr);
    cairo_set_source_rgba(cr, 1, 0, 0, 0.9);
    cairo_set_line_width(cr, 30);
    cairo_translate(cr, 320/2, 240/2);
    /*cairo_arc(cr, 0, 0, 320/3, 0, 2 * M_PI);*/
    cairo_move_to(cr, 10, 20);
    cairo_stroke(cr);
    cairo_save(cr);
    cairo_set_source_rgba(cr, 1, 1, 0, 1);
    cairo_move_to(cr, 1, 2);
    cairo_stroke(cr);
    cairo_restore(cr);
    cairo_move_to(cr, 1, 2);
    cairo_restore(cr);

    cairo_set_line_width(cr, 5);
    cairo_set_source_rgba(cr, 0, 1, 0, 1);
    cairo_translate(cr, 0, 240/2);
    cairo_scale(cr, 1, 100 / 40.0 + 0.5);
    cairo_set_font_size(cr, 320/3);
    cairo_move_to(cr, 0, -320/3);
    cairo_stroke(cr);

    /*enum AVPixelFormat f;*/
    /*const AVPixFmtDescriptor *desc;*/
    /*FFDrawContext draw;*/
    /*FFDrawColor color;*/
    /*int r, i;*/
    /**/
    /*for (f = 0; av_pix_fmt_desc_get(f); f++) {*/
    /*    desc = av_pix_fmt_desc_get(f);*/
    /*    if (!desc->name)*/
    /*        continue;*/
    /*    printf("Testing %s...%*s", desc->name,*/
    /*           (int)(16 - strlen(desc->name)), "");*/
    /*    r = ff_draw_init(&draw, f, 0);*/
    /*    if (r < 0) {*/
    /*        char buf[128];*/
    /*        av_strerror(r, buf, sizeof(buf));*/
    /*        printf("no: %s\n", buf);*/
    /*        continue;*/
    /*    }*/
    /*    ff_draw_color(&draw, &color, (uint8_t[]) { 1, 0, 0, 1 });*/
    /*    for (i = 0; i < sizeof(color); i++)*/
    /*        if (((uint8_t *)&color)[i] != 128)*/
    /*            break;*/
    /*    if (i == sizeof(color)) {*/
    /*        printf("fallback color\n");*/
    /*        continue;*/
    /*    }*/
    /*    printf("ok\n");*/
    /*}*/
    /*return 0;*/
}
