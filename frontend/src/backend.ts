import { createContext, createElement } from "react";

import RenderWorkerImpl from "./render/worker?worker";
import { Action, VideoParams, Request, Response } from "./render/protocol";

type ListenerCallback = (response: Response) => void;

interface Listener {
    timeoutId: ReturnType<typeof setTimeout>;
    callback: ListenerCallback;
}

interface ExportVideoHandlers {
    onProgress(frames: number): void;
    onError(error: string): void;
    onFinish(objectURL: string, size: number, duration: number): void;
}

export interface ExportVideoTask {
    cancel(): void;
}

const Backend = {

    renderWorker: new RenderWorkerImpl({ name: "MainRender" }),

    pendingCanvas: undefined as HTMLCanvasElement|undefined,

    responseListeners: new Map<number, Listener>(),

    lastRequestId: 0,

    init(canvas: HTMLCanvasElement) {
        this.renderWorker.onmessage = (event) => this.handleResponse(event);
        this._postMessage({ request: "init" });

        this.pendingCanvas = canvas;
    },

    handleResponse(event: MessageEvent<any>) {
        const response: Response = event.data;

        if ("init" in response && response.init === "ok") {
            const canvas = this.pendingCanvas;
            if (canvas === undefined || canvas.dataset.drawvgInWorker !== undefined)
                return;

            delete this.pendingCanvas;

            canvas.dataset.drawvgInWorker = ".";
            const offscreen = canvas.transferControlToOffscreen();
            this.renderWorker.postMessage(
                <Request>{ request: "register", canvas: offscreen },
                [ offscreen ]
            );

            return;
        }

        if ("requestId" in response) {
            const listener = this.responseListeners.get(response.requestId);
            this.responseListeners.delete(response.requestId);

            if (listener) {
                listener.callback(response);
                clearTimeout(listener.timeoutId);
            }

            return;
        }

        console.error("Invalid response from worker:", response);
    },

    sendAction(action: Action, callback?: ListenerCallback) {
        const requestId = ++this.lastRequestId;

        if (callback !== undefined) {
            const timeoutId = setTimeout(
                () => {
                    this.responseListeners.delete(requestId);
                    console.error("Timeout waiting for response.", { action });
                }, 3000,
            );

            this.responseListeners.set(requestId, { timeoutId, callback });
        }

        this._postMessage({ request: "action", requestId, action });
    },

    exportVideo(params: VideoParams, handlers: ExportVideoHandlers): ExportVideoTask {
        const exporter = new RenderWorkerImpl({ name: "ExportVideo" });

        let start = NaN;

        exporter.onmessage = (event) => {
            const response: Response = event.data;

            if ("init" in response && response.init === "ok") {
                start = performance.now();
                exporter.postMessage(<Request>{ request: "video", params });
                return;
            }

            if ("videoProgress" in response) {
                const vp = response.videoProgress;
                handlers.onProgress(vp.frames);
                return;
            }

            if ("videoFinish" in response) {
                const duration = performance.now() - start;
                const buffer = response.videoFinish.buffer;
                const url = URL.createObjectURL(new Blob([buffer], { type: "video/webm" }));
                handlers.onFinish(url, buffer.byteLength, duration);
                exporter.terminate();
                return;
            }

            if ("videoError" in response) {
                handlers.onError(response.videoError.error);
                exporter.terminate();
                return;
            }

            console.warn("Invalid message from worker", response);
        };

        exporter.postMessage(<Request>{ request: "init" });

        return {
            cancel() { exporter.terminate(); },
        };
    },

    setVisibility(visibility: boolean) {
        this._postMessage({ request: "state", change: { visibility } });
    },

    setPlaying(playing: boolean, speed: number) {
        this._postMessage({ request: "state", change: { playing, speed } });
    },

    setSize(size: [number, number]) {
        this._postMessage({ request: "state", change: { size } });
    },

    setSource(source: string) {
        this._postMessage({ request: "state", change: { source } });
    },

    _postMessage(message: Request) {
        this.renderWorker.postMessage(message);
    },

};

document.addEventListener(
    "visibilitychange",
    () => Backend.setVisibility(!document.hidden),
);

(<any>window).renderWorkerDumpMemoryStats = () => {
    Backend.sendAction("DumpMemoryStats");
};

const Context = createContext(Backend);

export function BackendProvider({ children }: { children: React.ReactNode }) {
    return createElement(Context.Provider, { children, value: Backend });
}

export default Context;
