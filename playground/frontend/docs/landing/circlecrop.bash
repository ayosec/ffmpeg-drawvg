ffmpeg \
    -an \
    -ss 14 -t 4.2 -i bigbuckbunny.mov \
    -/vf circlecrop.filter \
    output.mp4
