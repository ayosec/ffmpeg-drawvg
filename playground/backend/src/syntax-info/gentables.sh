#!/usr/bin/env bash

set -euo pipefail

FFMPEG_ROOT=$1
OUTPUT=$2

SYN_INFO=$(dirname "$0")

tmpfile=$(mktemp)
exec > "$tmpfile"


dump_ast() {
    local filter=$1
    local source="$FFMPEG_ROOT/$2"

    local flags=(
        -Xclang -ast-dump=json
        -Xclang -ast-dump-filter="$filter"
        -fsyntax-only
        -Wno-everything
        $(pkg-config --cflags cairo)
        -I"$FFMPEG_ROOT"
    )

    "$CC" "${flags[@]}" "$source"
}


# Instructions

echo -n 'export const Instructions = new Set('
dump_ast vgs_commands libavfilter/vf_drawvg.c |
    jq '.inner|map(.inner[]|.inner[0]|.inner[]|.inner[].value|fromjson)'
echo ');'

echo -n 'export const InstructionsDecls: string[] = '
dump_ast VGSCommand libavfilter/vf_drawvg.c |
    jq --from-file "$SYN_INFO/extract_decls.jq"
echo ';'

echo -n 'export const Colors: { [color: string]: [number, number, number] } = '
dump_ast color_table libavutil/parseutils.c |
    jq --from-file "$SYN_INFO/extract_colors.jq"
echo ';'

exec >&-
mv "$tmpfile" "$OUTPUT"
