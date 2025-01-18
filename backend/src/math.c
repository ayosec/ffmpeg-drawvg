#include <emscripten.h>
#include <stdint.h>

uint32_t av_get_random_seed(void) {
    return (uint32_t)(emscripten_random() * (float)UINT32_MAX);
}
