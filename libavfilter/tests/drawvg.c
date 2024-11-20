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

#include "libavutil/pixdesc.h"
#include "libavfilter/vf_drawvg.c"

// Mock for cairo functions. They just print their arguments.
//
// `MOCK_FNx` macros define wrappers for functions that only
// receive arguments of type `double`.

#define MOCK_FN0(func) \
    void func(cairo_t* cr) { \
        puts(#func); \
    }

#define MOCK_FN1(func) \
    void func(cairo_t* cr, double a0) { \
        printf(#func " %g\n", a0); \
    }

#define MOCK_FN2(func) \
    void func(cairo_t* cr, double a0, double a1) { \
        printf(#func " %g %g\n", a0, a1); \
    }

#define MOCK_FN4(func) \
    void func(cairo_t* cr, double a0, double a1, double a2, double a3) { \
        printf(#func " %g %g %g %g\n", a0, a1, a2, a3); \
    }

#define MOCK_FN5(func) \
    void func(cairo_t* cr, double a0, double a1, double a2, double a3, double a4) { \
        printf(#func " %g %g %g %g %g\n", a0, a1, a2, a3, a4); \
    }

#define MOCK_FN6(func) \
    void func(cairo_t* cr, double a0, double a1, double a2, double a3, double a4, double a5) { \
        printf(#func " %g %g %g %g %g %g\n", a0, a1, a2, a3, a4, a5); \
    }

MOCK_FN5(cairo_arc);
MOCK_FN0(cairo_clip_preserve);
MOCK_FN0(cairo_close_path);
MOCK_FN6(cairo_curve_to);
MOCK_FN0(cairo_fill_preserve);
MOCK_FN2(cairo_line_to);
MOCK_FN2(cairo_move_to);
MOCK_FN0(cairo_new_path);
MOCK_FN6(cairo_rel_curve_to);
MOCK_FN2(cairo_rel_line_to);
MOCK_FN2(cairo_rel_move_to);
MOCK_FN0(cairo_reset_clip);
MOCK_FN0(cairo_restore);
MOCK_FN1(cairo_rotate);
MOCK_FN0(cairo_save);
MOCK_FN2(cairo_scale);
MOCK_FN1(cairo_set_font_size);
MOCK_FN1(cairo_set_line_width);
MOCK_FN1(cairo_set_miter_limit);
MOCK_FN4(cairo_set_source_rgba);
MOCK_FN0(cairo_stroke_preserve);
MOCK_FN2(cairo_translate);

void cairo_get_current_point(cairo_t *cr, double *x, double *y) {
    *x = 100;
    *y = 200;
}

// Veify that the `command_specs` is sorted. This is required because
// the search is done with `bsearch(3)`.
static void check_sort_cmd_specs(void) {
    int failures = 0;

    for (int i = 0;; i++) {
        if (instruction_specs[i + 1].name == NULL) {
            break;
        }

        if (comparator_instruction_spec(&instruction_specs[i], &instruction_specs[i]) != 0) {
            printf("%s: comparator must return 0 for item %d\n", __func__, i);
            failures++;
        }

        if (comparator_instruction_spec(&instruction_specs[i], &instruction_specs[i + 1]) >= 0) {
            printf("%s: entry for '%s' must appear after '%s', at index %d\n",
                __func__, instruction_specs[i].name, instruction_specs[i + 1].name, i);
            failures++;
        }
    }

    printf("%s: %d failures\n\n", __func__, failures);
}

// Compile and run a script.
static void check_script(const char* source) {
    int ret;
    struct Script script;

    ret = script_parse(source, &script);
    if (ret != 0) {
        printf("%s: script_parse: %d\n", __func__, ret);
        return;
    }

    script_free(&script);
}

int main(void)
{
    cairo_t *cr = NULL;

    check_sort_cmd_specs();

    check_script("M 0 0 1 1 lineto 10 20 stroke");

    // Simple example.
    cairo_save(cr);
    cairo_set_source_rgba(cr, 1, 0, 0, 0.9);
    cairo_set_line_width(cr, 30);
    cairo_translate(cr, 320/2, 240/2);
    cairo_arc(cr, 0, 0, 1, 0, 1);
    cairo_move_to(cr, 10, 20);
    cairo_stroke_preserve(cr);
    cairo_save(cr);
    cairo_set_source_rgba(cr, 1, 1, 0, 1);
    cairo_move_to(cr, 1, 2);
    cairo_stroke_preserve(cr);
    cairo_restore(cr);
    cairo_move_to(cr, 1, 2);
    cairo_restore(cr);

    cairo_set_line_width(cr, 5);
    cairo_set_source_rgba(cr, 0, 1, 0, 1);
    cairo_translate(cr, 0, 240/2);
    cairo_scale(cr, 1, 100 / 40.0 + 0.5);
    cairo_set_font_size(cr, 320/3);
    cairo_move_to(cr, 0, -320/3);
    cairo_stroke_preserve(cr);

    return 0;
}
