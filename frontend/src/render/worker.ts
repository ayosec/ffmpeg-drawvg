import * as protocol from "./protocol";
import * as shaders from "./graphics";
import SerialNumber from "../serial";
import createMachine, { Machine, Program } from "./machine";

class DrawContext {
    #playing = false;
    #frameCount: number = 0;
    #playFixedTime: number = 0;

    #visibility = true;

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

    isVisible(): boolean {
        return this.#visibility;
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

    setVisibility(visibility: boolean) {
        this.#visibility = visibility;
    }

    playbackReset() {
        const now = performance.now();

        this.#frameCount = 0;
        this.#lastDuration = 1 / 60;
        this.#playFixedTime = 0;
        this.#playStart = now;
        this.#lastRenderTime = now - this.#lastDuration;
    }

    playbackNextFrame() {
        if (this.#playing)
            return;

        this.#frameCount++;
        this.#playFixedTime += this.#lastDuration * 1000;
    }

    playbackPreviousFrame() {
        if (this.#playing)
            return;

        this.#frameCount--;
        this.#playFixedTime -= this.#lastDuration * 1000;
    }

    nextFrameVars(timestamp?: number): { D: number; N: number; T: number } {
        if (this.#playing) {
            const now = timestamp ?? performance.now();

            // Round `duration` to a multiply of 10fps.
            const elapsed = (now - this.#lastRenderTime) / 1000;
            const duration = 1 / (10 * Math.round(1 / (elapsed * 10)));

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

const RenderTimeBuffer = {
    array: new Float32Array(512),
    count: 0,
    startFrame: NaN,

    add(frameNumber: number, value: number) {
        if (this.count === 0)
            this.startFrame = frameNumber;

        if (this.count < this.array.length)
            this.array[this.count++] = value;
    },

    dump() {
        const data = this.array.slice(0, this.count);
        this.count = 0;
        return { uniqueId: SerialNumber.next(), startFrame: this.startFrame, data };
    },
};

interface State {
    drawContext?: DrawContext;
    machine?: Machine;
    program?: Program;
    stateChanges?: protocol.StateChange[],
    resizeRequest?: [number, number];
    pendingDrawId?: number;
}

const STATE: State = {};

self.onmessage = event => {
    const message: protocol.Request = event.data;

    switch (message.request) {
        case "init":
            createMachine(responseSender).then(machine => {
                STATE.machine = machine;
                self.postMessage({ init: "ok" });
            });

            break;

        case "register":
            register(message.canvas);
            break;

        case "state":
            STATE.stateChanges ??= [];
            STATE.stateChanges.push(message.change);

            if (STATE.machine)
                requestRedraw();

            break;

        case "action":
            handleAction(message.requestId, message.action);
            break;

        default:
            console.error("Invalid message", event.data);
    }
};

function configureGraphicsContext(canvas: OffscreenCanvas) {
    const gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        desynchronized: true,
        stencil: false,
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

    return new DrawContext(canvas, gl, vertices.count);
}

function register(canvas: OffscreenCanvas) {
    STATE.drawContext = configureGraphicsContext(canvas);

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

    const { drawContext, program, resizeRequest } = STATE;

    if (drawContext === undefined || program === undefined)
        return;

    const { canvas, gl, verticesCount } = drawContext;

    const frameVars = drawContext.nextFrameVars(timestamp);

    // If the page is not visible, skip the render after updating
    // the frame variables.
    if (!drawContext.isVisible()) {
        if (drawContext.isPlaying())
            requestRedraw();

        return;
    }

    const D = frameVars.D;
    const N = frameVars.N;
    const T = frameVars.T;

    const W = resizeRequest ? resizeRequest[0] : canvas.width;
    const H = resizeRequest ? resizeRequest[1] : canvas.height;

    const startTime = performance.now();

    const data = program.run(W, H, T, N, D);

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

    const renderTime = performance.now() - startTime;

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


    RenderTimeBuffer.add(N, renderTime);

}

function applyStateChanges(timestamp?: number) {
    const { machine, drawContext, stateChanges } = STATE;

    if (machine === undefined || stateChanges === undefined || drawContext === undefined)
        return;

    for (const change of stateChanges) {

        if (change.source) {
            const vgsProgram = machine.compile(change.source);
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

        if (change.visibility !== undefined) {
            drawContext.setVisibility(change.visibility);
        }

    }

    STATE.stateChanges = undefined;
}

function handleAction(requestId: number, action: protocol.Action) {
    const { machine, drawContext } = STATE;

    if (machine === undefined || drawContext == undefined) {
        responseSender({ requestId, failure: "Uninitialized" });
        return;
    }

    switch (action) {
        case "DumpMemoryStats":
            console.log(machine.memStats());
            break;

        case "GetLogs":
            machine.ffi.logsSend(requestId);
            break;

        case "GetResourceUsage":
            sendResourceUsage(requestId);
            break;

        case "NextFrame":
            drawContext.playbackNextFrame();
            requestRedraw();
            break;

        case "PreviousFrame":
            drawContext.playbackPreviousFrame();
            requestRedraw();
            break;

        case "ResetPlayback":
            drawContext.playbackReset();
            requestRedraw();
            break;

        default:
            responseSender({ requestId, failure: `Invalid action: ${JSON.stringify(action)}` });
    }
}

function sendResourceUsage(requestId: number) {
    const renderTimeChunk = RenderTimeBuffer.dump();

    responseSender({ requestId, resourceUsage: { renderTimeChunk } });
}

function responseSender(response: protocol.Response) {
    self.postMessage(response);
}
