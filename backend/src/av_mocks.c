#include <emscripten.h>
#include <stdint.h>

uint32_t av_get_random_seed(void) {
    return (uint32_t)(emscripten_random() * (float)UINT32_MAX);
}

void* av_dict_get(void* a, void* b, void* c, int d) {
    return NULL;
}
