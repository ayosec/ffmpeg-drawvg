import { useEffect, useRef, useState } from "react";

import RenderWorkerImpl from "./render/worker?worker";

interface Props {
    source: string;
};

const RenderWorker = new RenderWorkerImpl();

class Handler {
    #currentSource?: string;
    #pendingCanvas?: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        RenderWorker.onmessage = (event) => this.handleResponse(event);
        RenderWorker.postMessage("init");

        this.#pendingCanvas = canvas;
    }

    handleResponse(event: MessageEvent<any>) {
        switch (event.data) {

            case "init:ok":
                const canvas = this.#pendingCanvas;
                if (canvas === undefined)
                    return;

                this.#pendingCanvas = undefined;

                if (canvas.dataset.drawvgInWorker === undefined) {
                    canvas.dataset.drawvgInWorker = ".";
                    const offscreen = canvas.transferControlToOffscreen();
                    RenderWorker.postMessage({ register: offscreen }, [ offscreen ]);
                } else {
                    this.sendPendingSource();
                }

                break;

            case "register:ok":
                this.sendPendingSource();
                break;

            default:
                console.error("Invalid response from worker:", event.data);

        }
    }

    setSource(source: string) {
        if(source === this.#currentSource)
            return;

        this.#currentSource = source;
        this.sendPendingSource();
    }

    private sendPendingSource() {
        if (this.#currentSource !== undefined)
            RenderWorker.postMessage({ compile: this.#currentSource } );
    }

};

export default function RenderView({ source }: Props) {

    const [ handler, setHandler ] = useState<Handler|null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas !== null)
            setHandler(new Handler(canvas));
    }, [ canvasRef.current ]);

    useEffect(() => {
        // TODO: update after a timeout (200ms)
        if (handler !== null)
            handler.setSource(source);
    }, [ handler, source ]);

    return(
        <canvas
            width="400"
            height="400"
            ref={canvasRef}
        />
    );

}
