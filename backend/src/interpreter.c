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

EMSCRIPTEN_KEEPALIVE
int *backend_memstats() {
    static int shared_buffer[2] = { 0, 0 };

    struct mallinfo mi = mallinfo();

    shared_buffer[0] = mi.fordblks;     // totalFreeSpace
    shared_buffer[1] = mi.uordblks;     // totalInUseSpace

    return shared_buffer;
}

// Parse a VGS script and return a program. The caller must free the
// memory for `source`.
//
// Return `NULL` on error.
EMSCRIPTEN_KEEPALIVE
struct VGSProgram* backend_program_new(double program_id, const char *source) {
    int ret;
    struct VGSProgram *program;
    struct VGSParser parser;

    program = calloc(1, sizeof(struct VGSProgram));

    CurrentFrameVariables.program_id = program_id;

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
    AVFrame frame;

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

    // Initialize a dummy frame with enough data for
    // the p(x,y) function.
    memset(&frame, 0, sizeof(frame));
    frame.data[0] = data;
    frame.linesize[0] = width * 4;
    frame.width = width;
    frame.height = height;
    frame.format = AV_PIX_FMT_RGB32;

    // VGS interpreter.
    vgs_eval_state_init(&eval_state, program, log_ctx(), &frame);

    eval_state.cairo_ctx = cairo_create(surface);

    eval_state.vars[VAR_N] = var_n;
    eval_state.vars[VAR_T] = var_t;
    eval_state.vars[VAR_TS] = 0;
    eval_state.vars[VAR_W] = width;
    eval_state.vars[VAR_H] = height;
    eval_state.vars[VAR_DURATION] = var_duration;

    ret = vgs_eval(&eval_state, program);

    cairo_destroy(eval_state.cairo_ctx);
    cairo_surface_destroy(surface);

    vgs_eval_state_free(&eval_state);

    CurrentFrameVariables.n = NAN;
    CurrentFrameVariables.t = NAN;

    if (ret != 0) {
        free(data);
        return NULL;
    }

    return data;

}
