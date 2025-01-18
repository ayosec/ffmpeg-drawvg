#include <cairo.h>
#include <endian.h>
#include <stdio.h>
#include <stdlib.h>

#include <emscripten.h>
#include <emscripten/html5.h>

#include "libavfilter/vf_drawvg.c"
#include "backend_logs.h"
#include "mallinfo.h"

static void *log_ctx() {
    static AVClass cls = {
        .class_name = "drawvg",
    };

    static AVClass *inst = &cls;

    return &inst;
}

static void memstats() {
    struct mallinfo mi = mallinfo();;

    EM_ASM({
        const memTracker = Module["memTracker"];
        if (typeof memTracker === "function") {
            memTracker({
               maxTotalAllocatedSpace: $0,
               totalAllocatedSpace: $1,
               totalFreeSpace: $2,
           });
        }
    }, mi.usmblks, mi.uordblks, mi.fordblks);
}

// Parse a VGS script and return a program. The caller must free the
// memory for `source`.
//
// Return `NULL` on error.
EMSCRIPTEN_KEEPALIVE
struct VGSProgram* backend_program_new(const char *source) {
    int ret;
    struct VGSProgram *program;
    struct VGSParser parser;

    program = calloc(1, sizeof(struct VGSProgram));

    vgs_parser_init(&parser, source);
    ret = vgs_parse(log_ctx(), &parser, program, 0);
    vgs_parser_free(&parser);

    if (ret != 0) {
        free(program);
        return NULL;
    }

    return program;
}

// Release resources for the compiled program.
EMSCRIPTEN_KEEPALIVE
void backend_program_free(struct VGSProgram *program) {
    vgs_free(program);
    free(program);
}

// Render a new frame and return the memory address of the new image.
EMSCRIPTEN_KEEPALIVE
void* backend_program_run(
    const struct VGSProgram *program,
    int report_mem_stats,
    int width,
    int height,
    double var_t,
    double var_n,
    double var_duration
) {
    int ret;
    uint8_t *data;
    size_t data_len;
    cairo_surface_t *surface;
    struct VGSEvalState eval_state;

    CurrentFrameVariables.n = var_n;
    CurrentFrameVariables.t = var_t;

    // Initialize the image with a white background.
    data_len = width * height * 4;
    data = malloc(data_len);
    memset(data, 255, data_len);

    surface = cairo_image_surface_create_for_data(
        data,
        CAIRO_FORMAT_ARGB32,
        width,
        height,
        width * 4
    );

    // VGS interpreter.
    vgs_eval_state_init(&eval_state, log_ctx());

    eval_state.cairo_ctx = cairo_create(surface);

    eval_state.vars[VAR_N] = var_n;
    eval_state.vars[VAR_T] = var_t;
    eval_state.vars[VAR_W] = width;
    eval_state.vars[VAR_H] = height;
    eval_state.vars[VAR_DURATION] = var_duration;

    ret = vgs_eval(&eval_state, program);

    cairo_destroy(eval_state.cairo_ctx);
    cairo_surface_destroy(surface);

    vgs_eval_state_free(&eval_state);

    if (report_mem_stats)
        memstats();

    CurrentFrameVariables.n = NAN;
    CurrentFrameVariables.t = NAN;

    if (ret != 0) {
        free(data);
        return NULL;
    }

    return data;

}
