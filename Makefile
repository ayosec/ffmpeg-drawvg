FFMPEG_SRC ?= ../FFmpeg

TARGET ?= target
OUTPUT = $(TARGET)/play.js

.PHONY: all
all: $(OUTPUT)

$(TARGET):
	mkdir -p $(TARGET)
	touch $(TARGET)/CACHEDIR.TAG

$(OUTPUT): | $(TARGET)
