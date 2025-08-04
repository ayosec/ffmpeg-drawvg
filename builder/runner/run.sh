#!/bin/bash

set -euo pipefail

runner=$(dirname "$0")
flake=$(realpath "$runner/..")

if [ -z "${FFMPEG_DIR:-}" ]
then
    echo "Missing FFMPEG_DIR"
    exit 1
fi

export FFMPEG_BIN="$FFMPEG_DIR/ffmpeg"

run() {
    local pkg="$1"
    shift 1

    printf '\n -- Running %s --\n\n' "$*"

    nix develop --print-build-logs "$flake#$pkg" --command "$@"
}

if [ ! -x "$FFMPEG_BIN" ]
then
    run ffmpeg "$runner/ffmpeg.sh" "$FFMPEG_DIR"
fi

run default "$runner/playground.sh" "$FFMPEG_DIR"
