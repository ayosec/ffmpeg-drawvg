varying highp vec2 texCoord;

uniform sampler2D texId;

uniform highp float t; //TODO(remove)

void main() {
    gl_FragColor = texture2D(texId, texCoord.xy) * t;
}
