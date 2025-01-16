#include <stdio.h>
#include <emscripten.h>

#include "libavutil/log.h"

const char *av_default_item_name(void *ptr)
{
    if (ptr == NULL)
        return NULL;

    AVClass *obj = *(AVClass**)ptr;
    return obj ? obj->class_name : "?";
}

void av_log(void* avcl, int level, const char *fmt, ...)
{
    va_list vl;

    if (avcl != NULL) {
        printf("[%s @ %p] ", av_default_item_name(avcl), avcl);
    }

    va_start(vl, fmt);
    //av_vlog(avcl, level, fmt, vl);
    vprintf(fmt, vl);
    va_end(vl);
}

uint32_t av_get_random_seed(void) {
    return (uint32_t)(emscripten_random() * (float)UINT32_MAX);
}
