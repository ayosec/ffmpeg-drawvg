#pragma once

struct LogString {
    long position;
    long length;
};

struct LogEvent {
    int repeat;
    int level;
    double var_t;
    double var_n;
    struct LogString class_name;
    struct LogString message;
};

struct FrameVariables {
    double t;
    double n;
};

extern struct FrameVariables CurrentFrameVariables;
