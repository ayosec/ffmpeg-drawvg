#include <stdio.h>
#include <emscripten.h>

#include "libavutil/log.h"

const char *av_default_item_name(void *ptr)
{
    return (*(AVClass **) ptr)->class_name;
}

void av_log(void* avcl, int level, const char *fmt, ...)
{
    va_list vl;
    va_start(vl, fmt);
    //av_vlog(avcl, level, fmt, vl);
    vprintf(fmt, vl);
    va_end(vl);
}

uint32_t av_get_random_seed(void) {
    return (uint32_t)(emscripten_random() * (float)UINT32_MAX);
}
