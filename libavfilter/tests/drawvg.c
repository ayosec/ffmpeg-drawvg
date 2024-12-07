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

#include <cairo.h>
#include <stdarg.h>
#include <stdio.h>

#include "libavutil/log.h"
#include "libavutil/pixdesc.h"

#define av_log mock_av_log

static void mock_av_log(void* avcl, int level, const char *fmt, ...) {
    va_list vl;

    printf("av_log[%d]: ", level);
    va_start(vl, fmt);
    vprintf(fmt, vl);
    va_end(vl);
}

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

cairo_bool_t cairo_has_current_point(cairo_t *cr) {
    return 1;
}

void cairo_get_current_point(cairo_t *cr, double *x, double *y) {
    *x = current_point_x;
    *y = current_point_y;
}

void cairo_set_source (cairo_t *cr, cairo_pattern_t *source) {
    double r, g, b, a;

    printf("%s", __func__);

    switch (cairo_pattern_get_type(source)) {
    case CAIRO_PATTERN_TYPE_SOLID:
        cairo_pattern_get_rgba(source, &r, &g, &b, &a);
        printf(" rgba(%.1f %.1f %.1f %.1f)", r, g, b, a);
        break;

    }

    printf("\n");
}

// Veify that the `command_specs` is sorted. This is required because
// the search is done with `bsearch(3)`.
static void check_sort_cmd_specs(void) {
    int failures = 0;

    for (int i = 0; i < INSTRUCTION_SPECS_COUNT  - 1; i++) {
        if (vgs_comp_instruction_spec(&vgs_instructions[i], &vgs_instructions[i]) != 0) {
            printf("%s: comparator must return 0 for item %d\n", __func__, i);
            failures++;
        }

        if (vgs_comp_instruction_spec(&vgs_instructions[i], &vgs_instructions[i + 1]) >= 0) {
            printf("%s: entry for '%s' must appear after '%s', at index %d\n",
                __func__, vgs_instructions[i].name, vgs_instructions[i + 1].name, i);
            failures++;
        }
    }

    printf("%s: %d failures\n", __func__, failures);
}

// Compile and run a script.
static void check_script(const char* source) {
    int ret;
    struct VGSProgram program;
    struct VGSEvalState state;
    vgs_eval_state_init(&state, NULL);

    for (int i = 0; i < VAR_COUNT; i++)
        state.vars[i] = 1 << i;

    printf("\n---\n%s:\n<<\n%s\n>>\n", __func__, source);

    current_point_x = 0;
    current_point_y = 0;

    ret = vgs_parse(NULL, source, &program, NULL);
    if (ret != 0) {
        printf("%s: vgs_parse = %d\n", __func__, ret);
        return;
    }

    ret = vgs_eval(&state, &program);
    vgs_eval_state_free(&state);

    if (ret != 0) {
        printf("%s: vgs_eval = %d\n", __func__, ret);
        return;
    }

    vgs_free(&program);
}

int main(void)
{
    char buf[512];

    check_sort_cmd_specs();

    check_script(
        "save\n"
        "scale 1 scalexy 2 3\n"
        "setlinejoin miter\n"
        "setlinecap round\n"
        "M 0 (PI * (1 + 0.5))\n"
        "l 10 10 L 20 20 v 1 V 2 h 3 H 4\n"
        "lineto 10 20\n"
        "setcolor red\n"
        "restore\n"
        "stroke"
    );

    // Comments.
    check_script("// a b\nsave\n// c d\nrestore //");

    // Stack values.
    check_script(
        "setvar 0 10 1 20 0 30 99 99\n"
        "M (getvar(0)) (getvar(0)) L (getvar(1)) (getvar(1))"
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

    // Long expressions. The parser must use malloc.
    memset(buf, 0, sizeof(buf));
    strncat(buf, "M 0 (1", sizeof(buf) - 1);
    for (int i = 0; i < 100; i++) {
        strncat(buf, " + n", sizeof(buf) - 1);
    }
    strncat(buf, ")", sizeof(buf) - 1);
    check_script(buf);

    return 0;
}
