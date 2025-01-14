#!/usr/bin/env bash

set -euo pipefail

FFMPEG_ROOT=$1
OUTPUT=$2

tmpfile=$(mktemp)
exec > "$tmpfile"


dump_ast() {
    local filter=$1
    local source="$FFMPEG_ROOT/$2"

    local flags=(
        -Wno-everything
        $(pkg-config --cflags cairo)
        -I"$FFMPEG_ROOT"
        -Xclang -ast-dump=json
        -Xclang -ast-dump-filter="$filter"
        -fsyntax-only
    )

    "$CC" "${flags[@]}" "$source"
}


# Instructions

echo -n 'export const Instructions = new Set('
dump_ast vgs_instructions libavfilter/vf_drawvg.c |
    jq '.inner|map(.inner[]|.inner[1]|.inner[]|.inner[].value|fromjson)'
    echo ');'


echo -n 'export Colors: { [color: string]: [number, number, number] } = '
dump_ast color_table libavutil/parseutils.c |
    jq --from-file src/extract_colors.jq
echo ';'

exec >&-
mv "$tmpfile" "$OUTPUT"
