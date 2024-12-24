// Build
//
//  $ emcc $(pkg-config --cflags --libs cairo) example.c -o example.html

#include <stdio.h>
#include <cairo.h>

int main() {
    cairo_surface_t *surface;
    cairo_t *cr;

    surface = cairo_image_surface_create(CAIRO_FORMAT_RGB24, 320, 240);
    cr = cairo_create(surface);

    cairo_set_source_rgb(cr, 0, 1, 1);
    cairo_rectangle(cr, 10, 10, 200, 200);
    cairo_fill(cr);

    printf("cr = %p\n", cr);

    return 0;
}
