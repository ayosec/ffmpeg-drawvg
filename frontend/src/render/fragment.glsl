varying highp vec2 texCoord;

uniform sampler2D texId;

void main() {
    gl_FragColor = texture2D(texId, texCoord.xy).bgra;
}
