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
    FILE *stream;

    int lost_events;

    int events_count;
    struct LogEvent events[LOG_EVENTS];

    char buffer[LOG_BUFFER_BYTES];
} LOG = { NULL };

struct FrameVariables CurrentFrameVariables = { NAN, NAN };

static void logs_reset() {
    LOG.lost_events = 0;
    LOG.events_count = 0;

    if (LOG.stream != NULL)
        rewind(LOG.stream);
}

static bool log_write_string(const char *src, struct LogString *dst) {
    if (LOG.lost_events != 0)
        return false;

    if (src[0] == '\0') {
        dst->position = 0;
        dst->length = 0;
        return true;
    }

    dst->position = ftell(LOG.stream);
    dst->length = fprintf(LOG.stream, "%s", src);
    return dst->length > 0;
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

    if (LOG.stream == NULL) {
        LOG.stream = fmemopen(LOG.buffer, sizeof(LOG.buffer), "w");
        logs_reset();
    }

    event = &LOG.events[LOG.events_count++];
    if (LOG.lost_events > 0 || LOG.events_count >= LOG_EVENTS)
        goto lost;

    memset(event, 0, sizeof(*event));

    event->level = level;
    event->var_n = CurrentFrameVariables.n;
    event->var_t = CurrentFrameVariables.t;

    if (avcl != NULL) {
        bool written = log_write_string(
            av_default_item_name(avcl),
            &event->class_name
        );

        if (!written)
            goto lost;
    }

    va_start(vl, fmt);
    event->message.position = ftell(LOG.stream);
    event->message.length = vfprintf(LOG.stream, fmt, vl);
    va_end(vl);

    if (repeated_message()) {
        // On repeated messages, increment counter of the previous message,
        // and discard the new entry.

        fseek(LOG.stream, SEEK_SET, event->message.position);

        LOG.events_count--;
        LOG.events[LOG.events_count - 1].repeat++;
    }

    return;

lost:
    LOG.lost_events++;
}

EMSCRIPTEN_KEEPALIVE
void backend_logs_send(int request_id) {
    fflush(LOG.stream);

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
