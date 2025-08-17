ffmpeg \
    -an \
    -ss 5 -t 10 -i bigbuckbunny.mov \
    -/filter_complex waves.filter \
    -c:v libvpx-vp9 \
    output.webm
