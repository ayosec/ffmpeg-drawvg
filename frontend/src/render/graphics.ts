import fragment from "./fragment.glsl?raw";
import vertex from "./vertex.glsl?raw";

interface ProgramData {
    progId: WebGLProgram,
    attrPos: GLint,
    unifTextId: WebGLUniformLocation,
}

interface BufferData {
    buffer: WebGLBuffer,
    count: GLsizei,
}

export function compileProgram(gl: WebGLRenderingContext): ProgramData | null {

    const program = gl.createProgram()!;

    for (const [ source, type ] of <const>[
        [ vertex, gl.VERTEX_SHADER ],
        [ fragment, gl.FRAGMENT_SHADER ]
    ]) {
        const shader = gl.createShader(type);

        if (shader === null) {
            console.error(`Unable to create a shader of type ${type}.`);
            return null;
        }

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Compilation failed:\n%s", gl.getShaderInfoLog(shader));
            return null;
        }

        gl.attachShader(program, shader);
    }

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link failed:\n%s", gl.getProgramInfoLog(program));
        return null;
    }

    return {
        progId: program,
        attrPos: gl.getAttribLocation(program, "pos"),
        unifTextId: gl.getUniformLocation(program, "texId")!,
    };

}

export function verticesBuffer(gl: WebGLRenderingContext): BufferData {
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const vertices = [
        -1, -1, // top left
        +1, -1, // top right
        -1, +1, // bottom left
        +1, +1, // bottom right
    ];

    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.STATIC_DRAW,
    );

    return {
        buffer,
        count: vertices.length / 2,
    };
}

export function prepareProgram(
    gl: WebGLRenderingContext,
    program: ProgramData,
    vertices: BufferData,
) {
    gl.useProgram(program.progId);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices.buffer);

    gl.enableVertexAttribArray(program.attrPos);
    gl.vertexAttribPointer(program.attrPos, 2, gl.FLOAT, false, 0, 0);
}
