ffmpeg \
    -f lavfi -i 'color=white:s=853x480:r=24:d=2' \
    -ss 16 -t 4 -i bigbuckbunny.mov \
    -ss 7:51 -t 6 -i bigbuckbunny.mov \
    -/filter_complex transition.filter \
    -an \
    output.mp4
