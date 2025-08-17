ffmpeg \
    -an \
    -ss 5 -t 10 -i bigbuckbunny.mov \
    -/filter_complex waves-plain.filter \
    output.mp4
