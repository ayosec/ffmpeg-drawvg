FFMPEG_ROOT ?= ../FFmpeg

AVUTIL_SOURCES = avstring.c eval.c mathematics.c mem.c parseutils.c reverse.c time.c
PLAY_SOURCES = em-ffmpeg.c main.c

CC = emcc
CFLAGS += -O2 -Wall
CFLAGS += -Wno-implicit-const-int-float-conversion -Wno-pointer-sign -Wno-switch
CFLAGS += -I$(FFMPEG_ROOT)
CFLAGS += $(shell pkg-config --cflags cairo)

LIBS += $(shell pkg-config --libs cairo)

TARGET ?= target

OUTPUT = $(TARGET)/play.html
OBJECTS = $(patsubst %.c,$(TARGET)/avutil/%.o,$(AVUTIL_SOURCES))
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
	$(CC) $(CFLAGS) $(LIBS) -o $@ $^

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
	jq -f builder/patch-compile.jq $(TMPFILE) > $@
