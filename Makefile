BUILD_TYPE ?= debug
RUN_CLOSURE ?= 0
FFMPEG_ROOT ?= ../FFmpeg

AVUTIL_SOURCES = avstring.c eval.c mathematics.c mem.c parseutils.c reverse.c time.c
PLAY_SOURCES = em-ffmpeg.c main.c

DEPENDENCIES = cairo zlib

CC = emcc


CFLAGS += -Wall -Wno-implicit-const-int-float-conversion -Wno-pointer-sign -Wno-switch
CFLAGS += -I$(FFMPEG_ROOT)
CFLAGS += $(shell pkg-config --cflags $(DEPENDENCIES))

LINK += $(shell pkg-config --libs $(DEPENDENCIES))

LINK += -s ALLOW_MEMORY_GROWTH=1
LINK += -s DEFAULT_TO_CXX=0
LINK += -s ENVIRONMENT=web,worker
LINK += -s EXIT_RUNTIME=0
LINK += -s EXPORT_ES6=1
LINK += -s EXPORT_NAME=createModule
LINK += -s FILESYSTEM=0
LINK += -s MAXIMUM_MEMORY=209715200
LINK += -s MODULARIZE=1
LINK += -s POLYFILL=0
LINK += -s TEXTDECODER=2

ifeq ($(BUILD_TYPE),debug)
  CFLAGS += -O1 -g
  LINK += -s ASSERTIONS=2
  LINK += -s STACK_OVERFLOW_CHECK=1
endif

ifeq ($(BUILD_TYPE),release)
  CFLAGS += -O3 -flto
endif

ifneq ($(RUN_CLOSURE),0)
  LINK += --closure $(RUN_CLOSURE)
endif


TARGET ?= target

export EM_CACHE = $(TARGET)/em-cache

export EM_CONFIG = $(TARGET)/em-config


OUTPUT = $(TARGET)/build/play.mjs
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

.PHONY: em-clean
em-clean:
	rm -rf $(EM_CONFIG) $(EM_CACHE)

$(TARGET):
	mkdir -p $(TARGET)
	touch $(TARGET)/CACHEDIR.TAG

$(OUTPUT): $(OBJECTS)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) $(LINK) -o $@ $^


$(EM_CONFIG): | $(TARGET)
	@echo "CACHE = '$(abspath $(EM_CACHE))'" > $@

$(TARGET)/avutil/%.o: $(FFMPEG_ROOT)/libavutil/%.c | $(EM_CONFIG)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -MJ $@.mj -c -o $@ $^

$(TARGET)/play/%.o: src/%.c | $(EM_CONFIG)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -MJ $@.mj -c -o $@ $^


$(COMPILEDB): TMPFILE=$(TARGET)/compiledb.tmp
$(COMPILEDB): $(OBJECTS)
	echo '[' > $(TMPFILE)
	cat $(addsuffix .mj,$^) >> $(TMPFILE)
	sed -i '$$s/,$$/]/' $(TMPFILE)
	jq -cf builder/patch-compiledb.jq $(TMPFILE) > $@
	rm $(TMPFILE)
