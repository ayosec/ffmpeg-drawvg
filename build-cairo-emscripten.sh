#!/bin/bash

# https://emscripten.org/docs/getting_started/downloads.html
# apt-get install -y meson git python3 wget pkg-config

set -xeuo pipefail

cd "$(mktemp -d)"

wget -O cairo.tar.xz https://deb.debian.org/debian/pool/main/c/cairo/cairo_1.18.2.orig.tar.xz
tar xf cairo.tar.xz

cd cairo*/

wget https://gist.github.com/kleisauke/acfa1c09522705efa5eb0541d2d00887/raw/100dc6eb7a27aca66f72715dbe9db4f569f9fbbc/emscripten-crossfile.meson

meson subprojects download pixman

# Prevent pthread detection.
sed -i 's/pthread.h/---no-pthread---/' \
    subprojects/pixman-*/meson.build \
    meson-cc-tests/pthread.c

meson setup _build \
    --prefix="$PWD/_dist" \
    --cross-file=emscripten-crossfile.meson \
    --default-library=static \
    --buildtype=release \
    -D{tests,zlib,png,glib,freetype,fontconfig,xcb}=disabled \
    -Dc_args='-DCAIRO_NO_MUTEX=1 -O2'

ninja -C _build all install


export PKG_CONFIG_PATH="$PWD/_dist/lib/pkgconfig"
pkg-config --cflags --libs cairo
