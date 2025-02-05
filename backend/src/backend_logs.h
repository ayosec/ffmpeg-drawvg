#pragma once

struct LogString {
    long position;
    long length;
};

struct LogEvent {
    int repeat;
    int level;
    double program_id;
    double var_t;
    double var_n;
    struct LogString class_name;
    struct LogString message;
};

struct FrameVariables {
    double program_id;
    double t;
    double n;
};

extern struct FrameVariables CurrentFrameVariables;
