#!/bin/bash

INSTALL_SH=$(realpath "${0%/*}/install.sh")

FFMPEG_DIR=$(realpath "$1")

NEW_IMAGE=${2:-docker-daemon:ffmpeg-drawvg:latest}

if [ ! -d "$FFMPEG_DIR" ]
then
    echo "Usage: $0 FFMPEG_DIR"
    exit 1
fi

crun() {
    local cmd=''
    for engine in podman docker
    do
        if [ -n "$(command -v $engine)" ]
        then
            cmd=$engine
            break
        fi
    done

    if [ -z "$cmd" ]
    then
        echo "No container engine found"
        exit 1
    fi

    ( set -x; $cmd run "$@" )
}

set -euo pipefail

: "${BUILD_IMAGE:=debian:stable}"

OUTPUT=$(mktemp -d)

# Container to build the binary.
crun \
    --rm \
    --volume "$FFMPEG_DIR:/S" \
    --volume "$INSTALL_SH:/I:ro" \
    --volume "$OUTPUT:/O" \
    --workdir /S \
    "$BUILD_IMAGE" /I /O


mapfile -t PACKAGES < "$OUTPUT/PACKAGES"
rm "$OUTPUT/PACKAGES"

# Build an image with the generated package.

BUILDER=$(buildah from "$BUILD_IMAGE")

set -x

buildah run "$BUILDER" apt-get update
buildah run "$BUILDER" apt-get install -y "${PACKAGES[@]}"

buildah copy "$BUILDER" "$OUTPUT" /

buildah config --cmd ffmpeg "$BUILDER"

IMAGE=$(buildah commit "$BUILDER")

buildah push "$IMAGE" "${NEW_IMAGE}"
