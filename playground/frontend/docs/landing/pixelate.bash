ffmpeg \
    -an \
    -ss 1 -t 18 -i bigbuckbunny.mov \
    -/filter_complex pixelate.filter \
    -c:v libvpx-vp9 \
    output.webm
