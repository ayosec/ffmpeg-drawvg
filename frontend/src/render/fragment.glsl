varying highp vec2 texCoord;

uniform sampler2D texId;

void main() {
    // Cairo writes ARGB pixels as 32-bits integers (0xAARRGGBB),
    // with premultiplied alpha.
    //
    // In little-endian architectures (like wasm32), each pixel
    // is a BGRA sequence, so it must be read as `.bgr` to get
    // the expected value.
    //
    // Alpha is ignored because it is premultiplied. This also
    // makes glClear() unnecessary.

    gl_FragColor = vec4(texture2D(texId, texCoord.xy).bgr, 1);
}
