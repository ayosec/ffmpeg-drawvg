attribute vec4 pos;

varying highp vec2 texCoord;

void main() {
    gl_Position = pos;
    texCoord = vec2((pos.x + 1.0) / 2.0, (-pos.y + 1.0) / 2.0);
}
