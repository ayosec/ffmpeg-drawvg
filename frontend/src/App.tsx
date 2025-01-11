import { useEffect, useRef } from "react";

import Render from "./render/worker?worker";
import styles from "./App.module.css";

const RENDER = new Render();

function registerCanvas(canvas: HTMLCanvasElement|null) {
    if (canvas === null || canvas.dataset.drawvgInWorker !== undefined)
        return;

    canvas.dataset.drawvgInWorker = ".";

    const offscreen = canvas.transferControlToOffscreen();
    RENDER.postMessage({ registry: offscreen }, [ offscreen ]);
}

function App() {

    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => { registerCanvas(canvasRef.current); }, [ canvasRef ]);

    return (
        <div className={styles.example}>
            <p>Playground</p>

            <canvas width="400" height="400" ref={canvasRef} />
        </div>
    )

}

export default App
