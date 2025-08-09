BUILD_TYPE ?= debug
RUN_CLOSURE ?= 0
FFMPEG_ROOT ?= ../FFmpeg

AVUTIL_SOURCES = avstring.c eval.c mathematics.c mem.c parseutils.c pixdesc.c reverse.c time.c
PLAY_SOURCES = interpreter.c logs.c av_mocks.c

DEPENDENCIES = cairo

NODEJS = node
CC = emcc


CFLAGS += -Wall -Wno-implicit-const-int-float-conversion -Wno-pointer-sign -Wno-switch
CFLAGS += -mbulk-memory
CFLAGS += -I$(FFMPEG_ROOT)
CFLAGS += $(shell pkg-config --cflags $(DEPENDENCIES))

LINK += $(shell pkg-config --libs $(DEPENDENCIES))

LINK += --closure $(RUN_CLOSURE)

LINK += -s ALLOW_MEMORY_GROWTH=1
LINK += -s DEFAULT_TO_CXX=0
LINK += -s ENVIRONMENT=worker
LINK += -s EXIT_RUNTIME=0
LINK += -s EXPORTED_FUNCTIONS=_free
LINK += -s EXPORTED_RUNTIME_METHODS=cwrap,HEAPU8
LINK += -s EXPORT_ES6=1
LINK += -s EXPORT_NAME=createModule
LINK += -s FILESYSTEM=0
LINK += -s MAXIMUM_MEMORY=209715200
LINK += -s MODULARIZE=1
LINK += -s POLYFILL=0
LINK += -s TEXTDECODER=2
LINK += -s WASM_BIGINT=1

ifeq ($(BUILD_TYPE),debug)
  CFLAGS += -O1 -g
  LINK += -s ASSERTIONS=2
  LINK += -s STACK_OVERFLOW_CHECK=1
endif

ifeq ($(BUILD_TYPE),release)
  CFLAGS += -O3 -flto
endif


TARGET ?= target

export EM_CACHE = $(abspath $(TARGET)/em-cache)

OUTPUT = $(TARGET)/build/play.mjs
OBJECTS = $(patsubst %.c,$(TARGET)/avutil/%.o,$(AVUTIL_SOURCES))
OBJECTS += $(patsubst %.c,$(TARGET)/play/%.o,$(PLAY_SOURCES))

SYNTAX_INFO = $(TARGET)/build/syntax.ts
DESERIALIZERS = $(TARGET)/build/deserializers.ts

COMPILEDB = compile_commands.json

.PHONY: all
all: $(OUTPUT) $(DESERIALIZERS) $(SYNTAX_INFO) $(COMPILEDB)


.PHONY: clean
clean: GARBAGE = $(OBJECTS) $(OUTPUT)
clean: GARBAGE += $(patsubst %.js,%.wasm,$(OUTPUT))
clean: GARBAGE += $(addsuffix .mj,$(OBJECTS))
clean: GARBAGE += $(SYNTAX_INFO) $(DESERIALIZERS)
clean:
	rm -f $(GARBAGE)

.PHONY: em-clean
em-clean:
	rm -rf $(EM_CACHE)

$(TARGET):
	mkdir -p $(TARGET)
	touch $(TARGET)/CACHEDIR.TAG

$(OUTPUT): $(OBJECTS)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) $(LINK) -o $@ $^


$(TARGET)/avutil/%.o: $(FFMPEG_ROOT)/libavutil/%.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -MJ $@.mj -c -o $@ $^

$(TARGET)/play/%.o: src/%.c
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -MJ $@.mj -c -o $@ $^


$(SYNTAX_INFO): src/syntax-info/gentables.sh src/syntax-info/*.jq
	$< $(FFMPEG_ROOT) $@

$(DESERIALIZERS): GENERATOR = $(TARGET)/deserializers-generator.js
$(DESERIALIZERS): src/deserializers.c
	$(CC) -Wall -o $(GENERATOR) $<
	$(NODEJS) $(GENERATOR) > $@.tmp
	mv $@.tmp $@
	rm $(GENERATOR) $(patsubst %.js,%.wasm,$(GENERATOR))

$(COMPILEDB): TMPFILE=$(TARGET)/compiledb.tmp
$(COMPILEDB): $(OBJECTS)
	echo '[' > $(TMPFILE)
	cat $(addsuffix .mj,$^) >> $(TMPFILE)
	sed -i '$$s/,$$/]/' $(TMPFILE)
	jq -cf ../builder/patch-compiledb.jq $(TMPFILE) > $@
	rm $(TMPFILE)
