ffmpeg \
    -an \
    -i highway.mp4 \
    -vf 'cropdetect, drawvg=file=cropdetect.vgs, format=yuv420p' \
    -c:v libvpx-vp9 \
    output.webm
