#!/bin/bash

set -euo pipefail

PLAYGROUND_DIR=$(git rev-parse --show-toplevel)

ffmpeg_dir=$1

set -x

cd "$PLAYGROUND_DIR/backend"
make FFMPEG_ROOT="$ffmpeg_dir" RUN_CLOUSURE=1 BUILD_TYPE=release all

cd "$PLAYGROUND_DIR/frontend"
npm install
npm run build
