import createBackend, { Backend, Program } from "./backend";
import * as shaders from "./graphics";

class DrawContext {
    #playing = false;
    #frameCount: number = 0;
    #playFixedTime: number = 0;

    #playStart: number;
    #lastRenderTime: number;

    #lastDuration: number = 1 / 60;

    constructor(
        readonly canvas: OffscreenCanvas,
        readonly gl: WebGLRenderingContext,
        readonly verticesCount: number
    ) {
        this.#playStart = performance.now();
        this.#lastRenderTime = performance.now();
    }

    isPlaying(): boolean {
        return this.#playing;
    }

    setPlaying(playing: boolean, timestamp?: number) {
        const now = timestamp ?? performance.now();

        if (playing && !this.#playing) {
            // Play.
            //
            // Initialize the value of `playStart` so it will
            // continue with the time before pausing.
            this.#lastRenderTime = now - this.#lastDuration;
            this.#playStart = now - this.#playFixedTime;
            this.#playing = true;
        } else if (!playing && this.#playing) {
            // Pause.
            //
            // Store the play time to reuse it in next renders.
            this.#playFixedTime = now - this.#playStart;
            this.#playing = false;
        }
    }

    nextFrameVars(timestamp?: number): { D: number; N: number; T: number } {
        if (this.#playing) {
            const now = timestamp ?? performance.now();

            // Round `duration` to a multiply of 30fps.
            const elapsed = (now - this.#lastRenderTime) / 1000;
            const duration = 1 / (30 * Math.round(1 / (elapsed * 30)));

            this.#lastRenderTime = now;
            this.#lastDuration = duration;

            return {
                D: duration,
                N: this.#frameCount++,
                T: (now - this.#playStart) / 1000,
            };
        } else {
            return {
                D: this.#lastDuration,
                N: this.#frameCount,
                T: this.#playFixedTime / 1000,
            };
        }
    }
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

    STATE.drawContext = new DrawContext(canvas, gl, vertices.count);

    if (STATE.pendingDrawId === undefined)
        draw();

}

function requestRedraw() {
    if (STATE.pendingDrawId !== undefined)
        return;

    STATE.pendingDrawId = requestAnimationFrame(timestamp => {
        STATE.pendingDrawId = undefined;
        draw(timestamp);
    });
}

function draw(timestamp?: number) {

    applyStateChanges(timestamp);

    const { backend, drawContext, program, resizeRequest } = STATE;

    if (backend === undefined || drawContext === undefined || program === undefined)
        return;

    const { canvas, gl, verticesCount } = drawContext;

    const frameVars = drawContext.nextFrameVars(timestamp);

    const D = frameVars.D;
    const N = frameVars.N;
    const T = frameVars.T;

    const W = resizeRequest ? resizeRequest[0] : canvas.width;
    const H = resizeRequest ? resizeRequest[1] : canvas.height;

    const data = program.run(false /*N % 25 == 0*/, W, H, T, N, D);

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
        // Resize canvas right before `drawArrays` to avoid flickering.

        drawContext.canvas.width = W;
        drawContext.canvas.height = H;
        drawContext.gl.viewport(0, 0, W, H);

        STATE.resizeRequest = undefined;
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, verticesCount);

    if (drawContext.isPlaying()) {
        requestRedraw();
    }
}

function applyStateChanges(timestamp?: number) {
    const { backend, drawContext, stateChanges } = STATE;

    if (backend === undefined || stateChanges === undefined || drawContext === undefined)
        return;

    for (const change of stateChanges) {

        if (change.source) {
            const vgsProgram = backend.compile(change.source);
            if (vgsProgram !== null) {
                STATE.program?.free();
                STATE.program = vgsProgram;
            }
        }

        if (change.size) {
            STATE.resizeRequest = change.size;
        }

        if (change.playing !== undefined) {
            drawContext.setPlaying(change.playing, timestamp);
        }

    }

    STATE.stateChanges = undefined;
}

/*
 ACTIONS:
    // jump to begining
    drawContext.startTime = performance.now();
    drawContext.frameCount = 0;
*/
