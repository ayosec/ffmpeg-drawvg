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

// Mock for cairo functions.
//
// `MOCK_FN_n` macros define wrappers for functions that only receive `n`
// arguments of type `double`.
//
// `MOCK_FN_I` macro wrap a function that receives a single integer value.

static double current_point_x;
static double current_point_y;

static void update_current_point(const char *func, double x, double y) {
    // Update current point only if the function name contains `_to`.
    if (strstr(func, "_to") == NULL) {
        return;
    }

    if (strstr(func, "_rel_") == NULL) {
        current_point_x = x;
        current_point_y = y;
    } else {
        current_point_x += x;
        current_point_y += y;
    }
}

#define MOCK_FN_0(func)      \
    void func(cairo_t* cr) { \
        puts(#func);         \
    }

#define MOCK_FN_1(func)                 \
    void func(cairo_t* cr, double a0) { \
        printf(#func " %.1f\n", a0);      \
    }

#define MOCK_FN_2(func)                            \
    void func(cairo_t* cr, double a0, double a1) { \
        update_current_point(#func, a0, a1);       \
        printf(#func " %.1f %.1f\n", a0, a1);          \
    }

#define MOCK_FN_4(func)                                                  \
    void func(cairo_t* cr, double a0, double a1, double a2, double a3) { \
        printf(#func " %.1f %.1f %.1f %.1f\n", a0, a1, a2, a3);                  \
    }

#define MOCK_FN_5(func)                                                             \
    void func(cairo_t* cr, double a0, double a1, double a2, double a3, double a4) { \
        printf(#func " %.1f %.1f %.1f %.1f %.1f\n", a0, a1, a2, a3, a4);                      \
    }

#define MOCK_FN_6(func)                                                                        \
    void func(cairo_t* cr, double a0, double a1, double a2, double a3, double a4, double a5) { \
        update_current_point(#func, a4, a5);                                                   \
        printf(#func " %.1f %.1f %.1f %.1f %.1f %.1f\n", a0, a1, a2, a3, a4, a5);                          \
    }

#define MOCK_FN_I(func, type)          \
    void func(cairo_t* cr, type i) {   \
        printf(#func " %d\n", (int)i); \
    }

MOCK_FN_5(cairo_arc);
MOCK_FN_0(cairo_clip_preserve);
MOCK_FN_0(cairo_close_path);
MOCK_FN_6(cairo_curve_to);
MOCK_FN_0(cairo_fill_preserve);
MOCK_FN_2(cairo_line_to);
MOCK_FN_2(cairo_move_to);
MOCK_FN_0(cairo_new_path);
MOCK_FN_6(cairo_rel_curve_to);
MOCK_FN_2(cairo_rel_line_to);
MOCK_FN_2(cairo_rel_move_to);
MOCK_FN_0(cairo_reset_clip);
MOCK_FN_0(cairo_restore);
MOCK_FN_1(cairo_rotate);
MOCK_FN_0(cairo_save);
MOCK_FN_2(cairo_scale);
MOCK_FN_1(cairo_set_font_size);
MOCK_FN_I(cairo_set_line_cap, cairo_line_cap_t);
MOCK_FN_I(cairo_set_line_join, cairo_line_join_t);
MOCK_FN_1(cairo_set_line_width);
MOCK_FN_1(cairo_set_miter_limit);
MOCK_FN_4(cairo_set_source_rgba);
MOCK_FN_0(cairo_stroke_preserve);
MOCK_FN_2(cairo_translate);

void cairo_get_current_point(cairo_t *cr, double *x, double *y) {
    *x = current_point_x;
    *y = current_point_y;
}

// Veify that the `command_specs` is sorted. This is required because
// the search is done with `bsearch(3)`.
static void check_sort_cmd_specs(void) {
    int failures = 0;

    for (int i = 0; i < INSTRUCTION_SPECS_COUNT  - 1; i++) {
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

    printf("%s: %d failures\n", __func__, failures);
}

// Compile and run a script.
static void check_script(const char* source) {
    int ret;
    struct Script script;
    struct ScriptEvalState state = {
        .rcp = { .valid = 0 },
        .vars = { 1, 2, 4, 8 },
    };

    printf("\n---\n%s: {%s}\n", __func__, source);

    current_point_x = 0;
    current_point_y = 0;

    ret = script_parse(NULL, source, &script);
    if (ret != 0) {
        printf("%s: script_parse = %d\n", __func__, ret);
        return;
    }

    ret = script_eval(&state, &script);
    if (ret != 0) {
        printf("%s: script_eval = %d\n", __func__, ret);
        return;
    }

    script_free(&script);
}

int main(void)
{
    check_sort_cmd_specs();

    check_script(
        "save\n"
        "scale 1 scalexy 2 3\n"
        "setlinejoin miter\n"
        "setlinecap round\n"
        "M 0 (PI * (1 + 0.5))\n"
        "lineto 10 20\n"
        "setcolor red\n"
        "restore\n"
        "stroke"
    );

    // Patterns
    check_script(
        "lineargrad 0 1 2 3\n"
        "colorstop 0 red\n"
        "colorstop 0.5 green\n"
        "colorstop 1 blue\n"
        "fill\n"
        "radialgrad 1 2 3 4 5 6\n"
        "colorstop 0 white\n"
        "colorstop 1 black\n"
        "stroke"
    );

    // From a SVG <path>.
    check_script("M 10,50 Q 25,25 40,50 t 30,0 30,0 30,0 30,0 30,0");

    // Detect unclosed expressions.
    check_script("M 0 (1*(t+1)");

    // Invalid instruction.
    check_script("save invalid 1 2");

    // Invalid constant.
    check_script("setlinecap unknown m 10 20");

    // Missing arguments.
    check_script("M 0 1 2");

    return 0;
}
