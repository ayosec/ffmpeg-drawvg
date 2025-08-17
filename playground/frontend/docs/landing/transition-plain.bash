ffmpeg \
    -f lavfi -i 'color=darkgray:s=qvga:r=60:d=2' \
    -vf 'drawvg=file=transition.vgs, format=yuv420p' \
    output.mp4
