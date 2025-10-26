#!/usr/bin/env bash

set -euo pipefail

FFMPEG_SRC="$(realpath "$1")"
WEB_OUTPUT="$(realpath "$2")"

BANNER=$(realpath "${0%/*}")/banner.html

set -x

cd "$(mktemp --directory)"

npm install less clean-css
PATH+=:$PWD/node_modules/.bin

git clone --filter tree:0 https://github.com/FFmpeg/web
cd web

sed --in-place 's/--disable-yasm/--disable-x86asm/' ./generate-doc.sh
sed --in-place "0r$BANNER" src/template_footer2

./generate-doc.sh "$FFMPEG_SRC"
make

mv --no-target-directory htdocs "$WEB_OUTPUT"
