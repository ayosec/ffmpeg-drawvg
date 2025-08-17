ffmpeg \
    -an \
    -ss 12 -t 3 -i bigbuckbunny.mov \
    -vf 'crop=iw-1, drawvg=file=progress.vgs, format=yuv420p' \
    -c:v libvpx-vp9 \
    output.webm
