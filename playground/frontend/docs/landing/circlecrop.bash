ffmpeg \
    -an \
    -ss 14 -t 4.2 -i bigbuckbunny.mov \
    -/vf circlecrop.filter \
    -c:v libvpx-vp9 \
    output.webm
