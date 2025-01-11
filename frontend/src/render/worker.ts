import createBackend, { Backend, Program } from "./backend";
import * as shaders from "./graphics";

interface DrawContext {
    canvas: OffscreenCanvas;
    gl: WebGLRenderingContext;
    verticesCount: number;

    frameCount: number;
    startTime: number;
}

interface State {
    drawContext?: DrawContext;
    backend?: Backend;
    program?: Program;
    pendingDrawId?: number;
}

const STATE: State = {};

self.onmessage = event => {

    if (event.data === "init") {
        createBackend().then(backend => {
            STATE.backend = backend;
            self.postMessage("init:ok");
        });
        return;
    }

    const newCanvas = event.data.register;
    if (newCanvas) {
        register(newCanvas);
        self.postMessage("register:ok");
        return;
    }

    const newSource = event.data.compile;
    if (newSource) {
        compile(newSource);
        return
    }

    console.error("Invalid message", event.data);
};

function register(canvas: OffscreenCanvas) {

    const gl = canvas.getContext("webgl");

    if (gl === null) {
        console.error("Can't get OffscreenCanvas context.");
        return;
    }

    const program = shaders.compileProgram(gl);
    if (program === null)
        return;

    const vertices = shaders.verticesBuffer(gl);

    shaders.prepareProgram(gl, program, vertices);

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    STATE.drawContext = {
        canvas,
        gl,
        verticesCount: vertices.count,
        frameCount: 0,
        startTime: performance.now(),
    };

}

function compile(source: string) {

    const backend = STATE.backend;

    if (backend === undefined || STATE.drawContext === undefined)
        return;

    const vgsProgram = backend.compile(source);
    if (vgsProgram === null)
        return;

    STATE.program?.free();
    STATE.program = vgsProgram;

    STATE.drawContext.startTime = performance.now();
    STATE.drawContext.frameCount = 0;

    draw();

}

function draw() {

    STATE.pendingDrawId = undefined;

    const { backend, drawContext, program } = STATE;

    if (backend === undefined || drawContext === undefined || program === undefined)
        return;

    const { canvas, gl, verticesCount} = drawContext;

    drawContext.frameCount++;

    const N = drawContext.frameCount;
    const T = (performance.now() - drawContext.startTime) / 1000;
    const W = canvas.width;
    const H = canvas.height;

    const data = program.run(N % 25 == 0, W, H, T, N, 1 / 60);

    if (data == null)
        return;

    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        W, H, 0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data.get(),
    );

    data.free();

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, verticesCount);

    if (T < 1) {
        if (STATE.pendingDrawId !== undefined) {
            cancelAnimationFrame(STATE.pendingDrawId);
        }

        STATE.pendingDrawId = requestAnimationFrame(draw);
    }
}
