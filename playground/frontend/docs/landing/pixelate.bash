ffmpeg \
    -an \
    -ss 1 -t 18 -i bigbuckbunny.mov \
    -/filter_complex pixelate.filter \
    output.mp4
