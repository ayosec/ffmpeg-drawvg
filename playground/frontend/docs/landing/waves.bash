ffmpeg \
    -an \
    -ss 5 -t 10 -i bigbuckbunny.mov \
    -/filter_complex waves.filter \
    output.mp4
