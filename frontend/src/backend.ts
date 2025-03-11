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

interface InitData {
    canvas: HTMLCanvasElement;
    size: [ number, number ];
    requestsQueue: Request[];
}

export interface ExportVideoTask {
    cancel(): void;
}

class VisibilityObserver {
    #handler: () => void;

    constructor(private readonly backend: Backend) {
        // Track visibility state. Use a timeout to detect if the
        // worker is still running.
        this.#handler = () => {
            const timeout = setTimeout(
                () => { this.remove(); },
                5000,
            );

            this.backend.setVisibility(!document.hidden);
            this.backend.sendAction(
                "Ping",
                () => { clearTimeout(timeout); },
                true,
            );
        };

        document.addEventListener("visibilitychange", this.#handler);
    }

    remove() {
        document.removeEventListener("visibilitychange", this.#handler);
    }
}

export default class Backend {
    #renderWorker: Worker;
    #responseListeners: Map<number, Listener>;
    #lastRequestId: number;
    #initData: InitData|undefined;
    #visibilityObserver: VisibilityObserver;

    constructor(name: string) {
        this.#renderWorker = new RenderWorkerImpl({ name });
        this.#responseListeners = new Map<number, Listener>();
        this.#lastRequestId = 0;
        this.#initData = undefined;
        this.#visibilityObserver = new VisibilityObserver(this);
    }

    init(canvas: HTMLCanvasElement, size: [ number, number ]) {
        this.#renderWorker.onmessage = (event) => this.handleResponse(event);
        this._postMessage({ request: "init" });

        this.#initData = { canvas, size, requestsQueue: [] };
    }

    handleResponse(event: MessageEvent<any>) {
        const response: Response = event.data;

        if ("init" in response && response.init === "ok") {
            if (this.#initData === undefined) {
                console.warn("Missing data to initialize canvas.");
                return;
            }

            const { canvas, size, requestsQueue } = this.#initData;
            this.#initData = undefined;

            if (canvas === undefined || canvas.dataset.drawvgInWorker !== undefined)
                return;

            canvas.dataset.drawvgInWorker = ".";

            const offscreen = canvas.transferControlToOffscreen();
            this.#renderWorker.postMessage(
                <Request>{ request: "register", canvas: offscreen, size },
                [ offscreen ]
            );

            for (const req of requestsQueue) {
                this.#renderWorker.postMessage(req);
            }

            return;
        }

        if ("requestId" in response) {
            const listener = this.#responseListeners.get(response.requestId);
            this.#responseListeners.delete(response.requestId);

            if (listener) {
                listener.callback(response);
                clearTimeout(listener.timeoutId);
            }

            return;
        }

        console.error("Invalid response from worker:", response);
    }

    sendAction(action: Action, callback?: ListenerCallback, ignoreTimeout?: boolean) {
        const requestId = ++this.#lastRequestId;

        if (callback !== undefined) {
            const timeoutId = setTimeout(
                () => {
                    this.#responseListeners.delete(requestId);
                    if (ignoreTimeout !== true)
                        console.error("Timeout waiting for response.", { action });
                },
                3000,
            );

            this.#responseListeners.set(requestId, { timeoutId, callback });
        }

        this._postMessage({ request: "action", requestId, action });
    }

    exportVideo(params: VideoParams, handlers: ExportVideoHandlers): ExportVideoTask {
        const exporter = this.#renderWorker;

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
    }

    setVisibility(visibility: boolean) {
        this._postMessage({ request: "state", change: { visibility } });
    }

    setPlaying(playing: boolean, speed: number) {
        this._postMessage({ request: "state", change: { playing, speed } });
    }

    setSize(size: [number, number]) {
        this._postMessage({ request: "state", change: { size } });
    }

    setProgram(id: number, source: string) {
        this._postMessage({ request: "state", change: { program: { id, source } } });
    }

    terminate() {
        this.#visibilityObserver.remove();
        this.#renderWorker.terminate();

        this.#renderWorker.postMessage = (message) => {
            console.debug(message);
            console.error("Backend is already terminated.");
        };
    }

    private _postMessage(message: Request) {
        if (this.#initData !== undefined)
            this.#initData.requestsQueue.push(message);
        else
            this.#renderWorker.postMessage(message);
    }
}
