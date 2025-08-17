ffmpeg \
    -an \
    -i highway.mp4 \
    -vf 'cropdetect, drawvg=file=cropdetect.vgs, format=yuv420p' \
    output.mp4
