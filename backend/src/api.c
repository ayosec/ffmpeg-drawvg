#include <stdlib.h>
#include <stdio.h>
#include <cairo.h>
#include <endian.h>

#include <emscripten.h>
#include <emscripten/html5.h>

#include "libavfilter/vf_drawvg.c"

#define W 400
#define H 400

typedef uint32_t u32;

EMSCRIPTEN_KEEPALIVE
int call_test(int a) {
    return a + 10;
}

#if 0
static void render(uint8_t *ptr, int w, int h)
{
    // `putImageData` expects pixels in groups of RGBA bytes
    //
    // Cairo uses ARGB in native-endian (so 0xARGB). Since wasm32 is
    // little-endian, pixels are stored as groups of BGRA bytes.
    //
    // To convert BGRA to RGBA, the value is converted to big-endian,
    // and then the first byte is rotated.
    for (
        u32 *px = (u32 *)ptr, *end = &px[w * h];
        px < end;
        px++
    ) {
        const u32 argb = htobe32(*px);
        *px = (argb << 24) | (argb >> 8);
    }

    EM_ASM({
      const data = new Uint8ClampedArray(Module["HEAPU8"].buffer, $0, $1 * $2 * 4);
      const context = Module["canvas"].getContext("2d");
      const imageData = new ImageData(data, $1, $2);
      context.putImageData(imageData, 0, 0);
    }, ptr, w, h);
}
#endif

EMSCRIPTEN_KEEPALIVE
uint8_t* simple_example() {
    int ret;
    uint8_t *data;
    cairo_surface_t *surface;
    //cairo_t *cr;

    struct VGSProgram program;
    struct VGSParser parser;
    struct VGSEvalState eval_state;

    // Compile
    vgs_parser_init(&parser, "repeat 4 { circle (w/8 * i) (h/2) 50  setcolor red@0.2 fill }");
    ret = vgs_parse(NULL, &parser, &program, 0);
    printf("vgs_parse ret = %d\n", ret);
    vgs_parser_free(&parser);

    // Cairo surface
    data = calloc(H * W, 4);

    surface = cairo_image_surface_create_for_data(
        data,
        CAIRO_FORMAT_ARGB32,
        W,
        H,
        W * 4
    );

    // Runner
    vgs_eval_state_init(&eval_state, NULL);
    eval_state.cairo_ctx = cairo_create(surface);
    eval_state.vars[VAR_W] = W;
    eval_state.vars[VAR_H] = H;
    ret = vgs_eval(&eval_state, &program);
    printf("vgs_eval ret = %d\n", ret);

    return data;
    /*render(data, W, H);*/
    //free(data);

    /*return 0;*/
}
