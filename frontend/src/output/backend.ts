import RenderWorkerImpl from "../render/worker?worker";

const Backend = {

    renderWorker: new RenderWorkerImpl(),

    pendingCanvas: undefined as HTMLCanvasElement|undefined,

    init(canvas: HTMLCanvasElement) {
        this.renderWorker.onmessage = (event) => this.handleResponse(event);
        this.renderWorker.postMessage("init");

        this.pendingCanvas = canvas;
    },

    handleResponse(event: MessageEvent<any>) {

        switch (event.data) {
            case "init:ok": {
                const canvas = this.pendingCanvas;
                if (canvas === undefined || canvas.dataset.drawvgInWorker !== undefined)
                    break;

                this.pendingCanvas = undefined;

                canvas.dataset.drawvgInWorker = ".";
                const offscreen = canvas.transferControlToOffscreen();
                this.renderWorker.postMessage({ register: offscreen }, [ offscreen ]);

                break;
            }

            default:
                console.error("Invalid response from worker:", event.data);
        }

    },

    setPlaying(playing: boolean) {
        this.renderWorker.postMessage({ state: { playing } });
    },

    setSize(size: [number, number]) {
        this.renderWorker.postMessage({ state: { size } });
    },

    setSource(source: string) {
        this.renderWorker.postMessage({ state: { source } });
    },

};

export default Backend;
