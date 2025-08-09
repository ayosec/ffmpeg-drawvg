#include <emscripten.h>
#include <math.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <sys/param.h>

#include "libavutil/log.h"
#include "backend_logs.h"

#define LOG_EVENTS 256

#define LOG_BUFFER_BYTES 4096

static struct {
    int lost_events;
    int events_count;
    struct LogEvent events[LOG_EVENTS];

    long buffer_position;
    char buffer[LOG_BUFFER_BYTES];
} LOG = { 0 };

struct FrameVariables CurrentFrameVariables = { NAN, NAN };

static void logs_reset() {
    LOG.buffer_position = 0;
    LOG.events_count = 0;
    LOG.lost_events = 0;
}

static bool log_write_string(const char *src, struct LogString *dst) {
    int len;

    if (LOG.lost_events != 0)
        return false;

    if (src[0] == '\0') {
        dst->position = 0;
        dst->length = 0;
        return true;
    }

    len = strlen(src);

    if (LOG.buffer_position + len >= sizeof(LOG.buffer))
        return false;

    dst->position = LOG.buffer_position;
    dst->length = len;

    memcpy(LOG.buffer + LOG.buffer_position, src, len);
    LOG.buffer_position += len;

    return true;
}

static bool log_string_eq(const struct LogString *a, const struct LogString *b) {
    return (
        a->length == b->length
            && memcmp(
                LOG.buffer + a->position,
                LOG.buffer + b->position,
                a->length
            ) == 0
    );
}

// Check if the last two messages have the same content.
//
// The values for `var_n` and `var_t` are ignored.
static bool repeated_message() {
    struct LogEvent *current, *previous;

    if (LOG.events_count < 2)
        return false;

    current = &LOG.events[LOG.events_count - 1];
    previous = &LOG.events[LOG.events_count - 2];

    return (
        current->level == previous->level
            && log_string_eq(&current->class_name, &previous->class_name)
            && log_string_eq(&current->message, &previous->message)
    );
}

const char *av_default_item_name(void *ptr)
{
    if (ptr == NULL)
        return NULL;

    AVClass *obj = *(AVClass**)ptr;
    return obj ? obj->class_name : "";
}

void av_log(void* avcl, int level, const char *fmt, ...)
{
    va_list vl;
    struct LogEvent *event;
    long old_bufpos;

    bool written;
    char msg[1024];

    event = &LOG.events[LOG.events_count++];
    if (LOG.lost_events > 0 || LOG.events_count >= LOG_EVENTS)
        goto lost;

    old_bufpos = LOG.buffer_position;

    memset(event, 0, sizeof(*event));

    event->repeat = 1;
    event->level = level;
    event->program_id = CurrentFrameVariables.program_id;
    event->var_n = CurrentFrameVariables.n;
    event->var_t = CurrentFrameVariables.t;

    if (avcl != NULL) {
        written = log_write_string(
            av_default_item_name(avcl),
            &event->class_name
        );

        if (!written)
            goto lost;
    }

    va_start(vl, fmt);
    vsnprintf(msg, sizeof(msg), fmt, vl);
    va_end(vl);

    written = log_write_string(msg, &event->message);
    if (!written)
        goto lost;

    if (repeated_message()) {
        // On repeated messages, increment counter of the previous message,
        // and discard the new entry.

        LOG.buffer_position = old_bufpos;
        LOG.events_count--;
        LOG.events[LOG.events_count - 1].repeat++;
        LOG.events[LOG.events_count - 1].program_id = CurrentFrameVariables.program_id;
    }

    return;

lost:
    LOG.events_count--;
    LOG.lost_events++;
}

EMSCRIPTEN_KEEPALIVE
void backend_logs_send(int request_id) {
    EM_ASM(
        { Module['machine']?.['logsReceive']($0, $1, $2, $3, $4); },
        request_id,
        LOG.events,
        MIN(LOG.events_count, LOG_EVENTS),
        LOG.buffer,
        LOG.lost_events
    );

    logs_reset();
}
