import createBackend, { Backend, Program } from "./backend";
import * as shaders from "./graphics";

interface DrawContext {
    canvas: OffscreenCanvas;
    gl: WebGLRenderingContext;
    verticesCount: number;

    playing: boolean;
    frameCount: number;
    startTime: number;
}

interface StateChange {
    source?: string;
    size?: [number, number];
    playing?: boolean;
}

interface State {
    drawContext?: DrawContext;
    backend?: Backend;
    program?: Program;
    stateChanges?: StateChange[],
    resizeRequest?: [number, number];
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
        return;
    }

    const stateChange = event.data.state;
    if (stateChange) {
        STATE.stateChanges ??= [];
        STATE.stateChanges.push(stateChange);

        if (STATE.backend)
            requestRedraw();

        return;
    }

    console.error("Invalid message", event.data);
};

function register(canvas: OffscreenCanvas) {

    const gl = canvas.getContext("webgl", {
        alpha: false,
        depth: false,
        stencil: false,
        desynchronized: true,
        preserveDrawingBuffer: true,
    });

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
        playing: false,
        frameCount: 0,
        startTime: performance.now(),
    };

    if (STATE.pendingDrawId === undefined)
        draw();
}

function requestRedraw() {
    if (STATE.pendingDrawId !== undefined)
        return;

    STATE.pendingDrawId = requestAnimationFrame(() => {
        STATE.pendingDrawId = undefined;
        draw();
    });
}

function draw() {

    applyStateChanges();

    const { backend, drawContext, program, resizeRequest } = STATE;

    if (backend === undefined || drawContext === undefined || program === undefined)
        return;

    const { canvas, gl, verticesCount } = drawContext;

    drawContext.frameCount++;

    // TODO: the time (`T`) should be frozen when `playing==false`.
    //       Thus, toggle "playing" button can be used as a pause.

    const N = drawContext.frameCount;
    const T = (performance.now() - drawContext.startTime) / 1000;
    const W = resizeRequest ? resizeRequest[0] : canvas.width;
    const H = resizeRequest ? resizeRequest[1] : canvas.height;

    const data = program.run(false /*N % 25 == 0*/, W, H, T, N, 1 / 60);

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

    if (resizeRequest) {
        drawContext.canvas.width = resizeRequest[0];
        drawContext.canvas.height = resizeRequest[1];
        drawContext.gl.viewport(0, 0, resizeRequest[0], resizeRequest[1]);
        STATE.resizeRequest = undefined;
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, verticesCount);

    if (drawContext.playing) {
        requestRedraw();
    }
}

function applyStateChanges() {
    const { backend, drawContext, stateChanges } = STATE;

    if (backend === undefined || stateChanges === undefined || drawContext === undefined)
        return;

    for (const change of stateChanges) {

        if (change.source) {
            const vgsProgram = backend.compile(change.source);
            if (vgsProgram !== null) {
                STATE.program?.free();
                STATE.program = vgsProgram;

                drawContext.startTime = performance.now();
                drawContext.frameCount = 0;
            }
        }

        if (change.size) {
            STATE.resizeRequest = change.size;
        }

        if (change.playing !== undefined) {
            drawContext.playing = change.playing;
        }

    }

    STATE.stateChanges = undefined;
}
