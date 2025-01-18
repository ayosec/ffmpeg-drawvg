import RenderWorkerImpl from "./render/worker?worker";
import { Action, Request, Response } from "./render/protocol";

type Listener = (response: Response) => void;

const Backend = {

    renderWorker: new RenderWorkerImpl(),

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

            if (listener)
                listener(response);

            return;
        }

        console.error("Invalid response from worker:", response);
    },

    sendAction(action: Action, listener?: Listener) {
        const requestId = ++this.lastRequestId;

        if (listener !== undefined) {
            this.responseListeners.set(requestId, listener);
        }

        this._postMessage({ request: "action", requestId, action });
    },

    setPlaying(playing: boolean) {
        this._postMessage({ request: "state", change: { playing } });
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

export default Backend;
