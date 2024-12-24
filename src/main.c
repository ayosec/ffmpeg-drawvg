#include <stdlib.h>
#include <stdio.h>
#include <cairo.h>
#include <emscripten.h>
#include <endian.h>

#define W 320
#define H 240

typedef uint32_t u32;

void render(uint8_t *ptr, int w, int h)
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
      const data = new Uint8ClampedArray(Module.HEAPU8.buffer, $0, $1 * $2 * 4);
      const context = Module["canvas"].getContext("2d");
      const imageData = new ImageData(data, $1, $2);
      context.putImageData(imageData, 0, 0);
    }, ptr, w, h);
}

int main() {
    uint8_t *data;
    cairo_surface_t *surface;
    cairo_t *cr;

    data = calloc(H * W, 4);

    surface = cairo_image_surface_create_for_data(
        data,
        CAIRO_FORMAT_ARGB32,
        W,
        H,
        W * 4
    );

    cr = cairo_create(surface);

    cairo_set_source_rgba(cr, 0, 1, 0.5, 1);
    cairo_paint(cr);

    cairo_set_source_rgba(cr, 1, 0.5, 0, 1);
    cairo_move_to(cr, 10, 10);
    cairo_line_to(cr, 100, 10);
    cairo_line_to(cr, 10, 100);
    cairo_close_path(cr);
    cairo_fill(cr);
    cairo_destroy(cr);

    printf("cr = %p\n", cr);

    render(data, W, H);
    free(data);

    return 0;
}
