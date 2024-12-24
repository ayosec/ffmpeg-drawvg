FFMPEG_ROOT ?= ../FFmpeg

FFMPEG_SOURCES = libavfilter/vf_drawvg.c libavutil/eval.c
PLAY_SOURCES = main.c

CC = emcc
CFLAGS += -O2 -Wall -Wno-pointer-sign -Wno-switch
CFLAGS += -I$(FFMPEG_ROOT)
CFLAGS += $(shell pkg-config --cflags cairo)

LIBS += $(shell pkg-config --libs cairo)

TARGET ?= target

OUTPUT = $(TARGET)/play.js
OBJECTS = $(patsubst %.c,$(TARGET)/ffmpeg/%.o,$(FFMPEG_SOURCES))
OBJECTS += $(patsubst %.c,$(TARGET)/play/%.o,$(PLAY_SOURCES))

COMPILEDB = compile_commands.json

.PHONY: all
all: $(OUTPUT) $(COMPILEDB)


.PHONY: clean
clean:
	rm -f $(OBJECTS) $(OUTPUT) \
		$(patsubst %.js,%.wasm,$(OUTPUT)) \
		$(addsuffix .mj,$(OBJECTS))


$(TARGET):
	mkdir -p $(TARGET)
	touch $(TARGET)/CACHEDIR.TAG

$(OUTPUT): $(OBJECTS)
	emcc $(CFLAGS) $(LIBS) -o $@ $^

$(TARGET)/ffmpeg/%.o: $(FFMPEG_ROOT)/%.c | $(TARGET)
	@mkdir -p $(dir $@)
	emcc $(CFLAGS) -MJ $@.mj -c -o $@ $^

$(TARGET)/play/%.o: src/%.c | $(TARGET)
	@mkdir -p $(dir $@)
	emcc $(CFLAGS) -MJ $@.mj -c -o $@ $^


$(COMPILEDB): TMPFILE=$(TARGET)/compiledb.tmp
$(COMPILEDB): $(OBJECTS)
	echo '[' > $(TMPFILE)
	cat $(addsuffix .mj,$^) >> $(TMPFILE)
	sed -i '$$s/,$$/]/' $(TMPFILE)
	jq -f builder/patch-compile.jq $(TMPFILE) > $@
