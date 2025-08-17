ffmpeg \
    -f lavfi -i 'color=darkgray:s=qvga:r=60:d=3' \
    -vf 'drawvg=file=progress.vgs, format=yuv420p' \
    output.mp4
