#include <assert.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>

#include "backend_logs.h"

enum FieldType {
    FT_INT,
    FT_DOUBLE,
    FT_LOG_STRING,
};

void write_init(const char *name, size_t size) {
    printf("export function deserialize%s(heap: ArrayBuffer, address: number, arrayIndex: number) {\n", name);
    printf("\taddress += arrayIndex * %zu;\n", size);
    printf("\tconst bytes = new DataView(heap, address, %zu);\n", size);
    printf("\treturn {\n");
}

void write_field(
    const char *field_name,
    size_t offset,
    size_t size,
    enum FieldType field_type
) {
    printf("\t\t%s: ", field_name);

    switch (field_type) {
        case FT_INT:
            assert(size == 4);
            printf("bytes.getInt32(%zu, true),", offset);
            break;

        case FT_DOUBLE:
            assert(size == 8);
            printf("bytes.getFloat64(%zu, true),", offset);
            break;

        case FT_LOG_STRING:
            assert(size == sizeof(struct LogString));
            printf("deserializeLogString(heap, address + %zu, 0),", offset);
            break;

        default:
            assert(0);
    }

    printf("\n");
}

void write_end() {
    puts("\t};\n};");
}


#define SER_INIT(struct_name) \
    write_init(#struct_name, sizeof(struct struct_name))

#define SER_FIELD(struct_name, field)           \
    write_field(                                \
        #field,                                 \
        offsetof(struct struct_name, field),    \
        sizeof(((struct struct_name){}).field), \
        _Generic(                               \
            ((struct struct_name){}).field,     \
            int: FT_INT,                        \
            long: FT_INT,                       \
            double: FT_DOUBLE,                  \
            struct LogString: FT_LOG_STRING     \
        )                                       \
    )


int main() {

    SER_INIT(LogString);
    SER_FIELD(LogString, position);
    SER_FIELD(LogString, length);
    write_end();

    SER_INIT(LogEvent);
    SER_FIELD(LogEvent, repeat);
    SER_FIELD(LogEvent, level);
    SER_FIELD(LogEvent, program_id);
    SER_FIELD(LogEvent, var_t);
    SER_FIELD(LogEvent, var_n);
    SER_FIELD(LogEvent, class_name);
    SER_FIELD(LogEvent, message);
    write_end();

}
