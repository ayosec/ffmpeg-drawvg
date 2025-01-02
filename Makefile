BUILD_TYPE ?= debug
RUN_CLOSURE ?= 0
FFMPEG_ROOT ?= ../FFmpeg

AVUTIL_SOURCES = avstring.c eval.c mathematics.c mem.c parseutils.c reverse.c time.c
PLAY_SOURCES = em-ffmpeg.c main.c

CC = emcc


CFLAGS += -Wall -Wno-implicit-const-int-float-conversion -Wno-pointer-sign -Wno-switch
CFLAGS += -I$(FFMPEG_ROOT)
CFLAGS += $(shell pkg-config --cflags cairo)

ifeq ($(BUILD_TYPE),debug)
  CFLAGS += -O1 -g
endif

ifeq ($(BUILD_TYPE),release)
  CFLAGS += -O3
endif


LINK += $(shell pkg-config --libs cairo)

ifneq ($(RUN_CLOSURE),0)
  LINK += --closure $(RUN_CLOSURE)
endif


TARGET ?= target

OUTPUT = $(TARGET)/play.mjs
OBJECTS = $(patsubst %.c,$(TARGET)/avutil/%.o,$(AVUTIL_SOURCES))
OBJECTS += $(patsubst %.c,$(TARGET)/play/%.o,$(PLAY_SOURCES))

COMPILEDB = compile_commands.json

.PHONY: all
all: $(OUTPUT) $(COMPILEDB)


.PHONY: clean
clean: GARBAGE = $(OBJECTS) $(OUTPUT)
clean: GARBAGE += $(patsubst %.js,%.wasm,$(OUTPUT))
clean: GARBAGE += $(addsuffix .mj,$(OBJECTS))
clean:
	rm -f $(GARBAGE)


$(TARGET):
	mkdir -p $(TARGET)
	touch $(TARGET)/CACHEDIR.TAG

$(OUTPUT): $(OBJECTS)
	$(CC) $(CFLAGS) $(LINK) -o $@ $^

$(TARGET)/avutil/%.o: $(FFMPEG_ROOT)/libavutil/%.c | $(TARGET)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -MJ $@.mj -c -o $@ $^

$(TARGET)/play/%.o: src/%.c | $(TARGET)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -MJ $@.mj -c -o $@ $^


$(COMPILEDB): TMPFILE=$(TARGET)/compiledb.tmp
$(COMPILEDB): $(OBJECTS)
	echo '[' > $(TMPFILE)
	cat $(addsuffix .mj,$^) >> $(TMPFILE)
	sed -i '$$s/,$$/]/' $(TMPFILE)
	jq -cf builder/patch-compiledb.jq $(TMPFILE) > $@
	rm $(TMPFILE)
