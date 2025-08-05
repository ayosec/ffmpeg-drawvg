#!/bin/bash
#
# This script is expected to be executed inside an ephemeral container,
# running on a Debian image.
#
# It builds and installs the FFmpeg binary in the directory, and also writes
# a $DESTDIR/PACKAGES file with a list of dependencies needed by the binary.

DESTDIR=${1:-}

if [ -z "$DESTDIR" ]
then
    echo "Usage: $0 DESTDIR"
    exit 1
fi

DEPS=(
    clang
    git
    libaom-dev
    libass-dev
    libbz2-dev
    libdav1d-dev
    libfontconfig-dev
    libfreetype-dev
    libharfbuzz-dev
    libjxl-dev
    liblzma-dev
    libmp3lame-dev
    libopenjp2-7-dev
    libopenmpt-dev
    libopus-dev
    librav1e-dev
    librsvg2-dev
    libsvtav1enc-dev
    libtheora-dev
    libtwolame-dev
    libvidstab-dev
    libvo-amrwbenc-dev
    libvorbis-dev
    libvpx-dev
    libwebp-dev
    libx264-dev
    libx265-dev
    libxml2-dev
    libxvidcore-dev
    libzimg-dev
    libzmq3-dev
    libzvbi-dev
    make
    nasm
    pkgconf
    rubygems
    texinfo
    zlib1g-dev
)

set -xeuo pipefail

apt-get update
apt-get install -y "${DEPS[@]}"

./configure \
    --cpu=x86-64-v3 \
    --cc=clang \
    --ld=clang \
    --prefix=/usr \
    --disable-{ffplay,ffprobe} \
    --disable-libmfx \
    --disable-omx \
    --disable-debug \
    --enable-gpl \
    --enable-libaom \
    --enable-libass \
    --enable-libdav1d \
    --enable-libfontconfig \
    --enable-libfreetype \
    --enable-libharfbuzz \
    --enable-libjxl \
    --enable-libmp3lame \
    --enable-libopenmpt \
    --enable-libopus \
    --enable-librsvg \
    --enable-libtheora \
    --enable-libtwolame \
    --enable-libvidstab \
    --enable-libvorbis \
    --enable-libvpx \
    --enable-libwebp \
    --enable-libx265 \
    --enable-libxml2 \
    --enable-libzimg


make -j"$(nproc)"
make DESTDIR="$DESTDIR" install

ldd ffmpeg \
    | awk '/=>/ { print $3 }' \
    | xargs -l1 basename \
    | xargs dpkg -S \
    | cut -f1 -d: \
    | sort \
    | uniq \
    > "$DESTDIR/PACKAGES"
