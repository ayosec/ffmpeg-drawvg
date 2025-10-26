#!/bin/bash

set -euo pipefail

nproc=$(nproc)

if [ -n "${1:-}" ]
then
    cd "$1"
fi

set -x

./configure \
    --cc=clang \
    --ld=clang \
    --disable-{ffplay,ffprobe} \
    --enable-{gpl,version3,cairo,librsvg,libfreetype,libharfbuzz,libvpx,libaom,fontconfig}

make "-j$nproc"

"$FFMPEG_BIN" -version
