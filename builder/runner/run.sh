#!/bin/bash

set -euo pipefail

: "${FFMPEG_BRANCH:=ffmpeg-drawvg}"

COMMIT=$(git rev-parse "$FFMPEG_BRANCH")

runner=$(dirname "$0")
flake=$(realpath "$runner/..")

flakeargs=()

if [ -n "${CI:-}" ]
then
    flakeargs=(--verbose --print-build-logs)
fi

ffmpeg_dir=$(
    git worktree list --porcelain \
        | paste -s \
        | sed 's/\t\t/\n/g' \
        | awk -v commit="$COMMIT" '$4 == commit { print $2; exit }'
)

if [ -z "$ffmpeg_dir" ]
then
    ffmpeg_dir=$(mktemp -d)
    git worktree add "$ffmpeg_dir" "$COMMIT"
fi

export FFMPEG_BIN="$ffmpeg_dir/ffmpeg"

run() {
    local pkg="$1"
    shift 1

    printf '\n -- Running %s --\n\n' "$*"

    nix develop "${flakeargs[@]}" "$flake#$pkg" --command "$@"
}

run ffmpeg "$runner/ffmpeg.sh" "$ffmpeg_dir"
run default "$runner/playground.sh" "$ffmpeg_dir"
