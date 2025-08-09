import * as protocol from "./protocol";
import * as shaders from "./graphics";
import SerialNumber from "../utils/serial";
import createMachine, { Machine, Program } from "./machine";
import exportVideo from "./exportVideo";

class DrawContext {
    visible = true;

    timeline: Timeline;

    constructor(
        readonly canvas: OffscreenCanvas,
        readonly gl: WebGLRenderingContext,
        readonly verticesCount: number
    ) {
        this.timeline = new Timeline();
    }
}

class Timeline {
    #playing = false;
    #speed = 1;

    #frameCount: number = 0;
    #playTime: number = 0;

    #lastRenderTime: number;
    #lastDuration: number = 1 / 60;

    constructor() {
        this.#lastRenderTime = performance.now();
    }

    isPlaying(): boolean {
        return this.#playing;
    }

    setPlaying(playing: boolean, timestamp?: number) {
        if (playing && !this.#playing) {
            // Play.
            this.#lastRenderTime = (timestamp ?? performance.now()) - this.#lastDuration * 1000;
            this.#playing = true;

        } else if (!playing && this.#playing) {
            // Pause.
            this.#playing = false;
        }
    }

    #roundFrame() {
        const frac = this.#frameCount % 1;
        if (frac === 0)
            return;

        if (frac < 0.5) {
            // Reset current frame.
            this.#frameCount = Math.floor(this.#frameCount);
            this.#playTime -= this.#lastDuration * frac;
        } else {
            // Jump to next frame.
            this.#frameCount = Math.ceil(this.#frameCount);
            this.#playTime += this.#lastDuration * (1 - frac);
        }
    }

    setSpeed(speed: number) {
        if (speed % 1 === 0)
            this.#roundFrame();

        this.#speed = speed;
    }

    playbackReset() {
        const now = performance.now();

        this.#frameCount = 0;
        this.#lastDuration = 1 / 60;
        this.#playTime = 0;
        this.#lastRenderTime = now - this.#lastDuration;
    }

    playbackNextFrame() {
        if (this.#playing)
            return;

        this.#roundFrame();

        this.#frameCount++;
        this.#playTime += this.#lastDuration;
    }

    playbackPreviousFrame() {
        if (this.#playing)
            return;

        this.#roundFrame();

        this.#frameCount--;
        this.#playTime -= this.#lastDuration;
    }

    nextFrameVars(timestamp?: number): { D: number; N: number; T: number } {
        if (this.#playing) {
            const now = timestamp ?? performance.now();

            // Round `duration` to a multiply of 10fps.
            const elapsed = (now - this.#lastRenderTime) / 1000;
            const duration = 1 / (10 * Math.round(1 / (elapsed * 10)));

            this.#lastRenderTime = now;
            this.#lastDuration = duration;

            const N = this.#frameCount;
            const T = this.#playTime;

            this.#frameCount += this.#speed;
            this.#playTime += elapsed * this.#speed;

            if (this.#frameCount < 0 || this.#playTime < 0) {
                this.#playTime = 60 * 60 * duration;
                this.#frameCount = 60 * 60;
            }

            return { D: duration, N, T };
        } else {
            return {
                D: this.#lastDuration,
                N: this.#frameCount,
                T: this.#playTime,
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

setTimeout(
    () => {
        if (STATE.machine === undefined) {
            console.error("Timeout waiting to initialize worker");
            self.close();
        }
    },
    60_000
);

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
            register(message.canvas, message.size);
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

        case "video":
            if (STATE.machine)
                exportVideo(STATE.machine, message.params);

            break;

        default:
            console.error("Invalid message", event.data);
    }
};

function createDrawContext(canvas: OffscreenCanvas) {
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

function register(canvas: OffscreenCanvas, size: [ number, number ]) {
    STATE.drawContext?.gl
        ?.getExtension("WEBGL_lose_context")
        ?.loseContext();

    STATE.drawContext = createDrawContext(canvas);
    STATE.resizeRequest = size;

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

    const frameVars = drawContext.timeline.nextFrameVars(timestamp);

    // If the page is not visible, skip the render after updating
    // the frame variables.
    if (!drawContext.visible) {
        if (drawContext.timeline.isPlaying())
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

    const renderTime = performance.now() - startTime;

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

    if (drawContext.timeline.isPlaying()) {
        requestRedraw();
    }


    RenderTimeBuffer.add(N, renderTime);

}

function applyStateChanges(timestamp?: number) {
    const { machine, drawContext, stateChanges } = STATE;

    if (machine === undefined || stateChanges === undefined || drawContext === undefined)
        return;

    for (const change of stateChanges) {

        if (change.program) {
            const vgsProgram = machine.compile(change.program.id, change.program.source);
            if (vgsProgram !== null) {
                STATE.program?.free();
                STATE.program = vgsProgram;
            }
        }

        if (change.size)
            STATE.resizeRequest = change.size;

        if (change.playing !== undefined)
            drawContext.timeline.setPlaying(change.playing, timestamp);

        if (change.speed !== undefined)
            drawContext.timeline.setSpeed(change.speed);

        if (change.visibility !== undefined)
            drawContext.visible = change.visibility;

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
            drawContext.timeline.playbackNextFrame();
            requestRedraw();
            break;

        case "Ping":
            responseSender({ requestId, pong: true });
            break;

        case "PreviousFrame":
            drawContext.timeline.playbackPreviousFrame();
            requestRedraw();
            break;

        case "ResetPlayback":
            drawContext.timeline.playbackReset();
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
