import { useContext, useEffect, useRef } from "react";

import BackendContext from "../backend";

interface Props {
    source: string;
    size: [number, number];
};

export default function RenderView({ source, size }: Props) {

    const backend = useContext(BackendContext);

    const canvasRef = useRef<HTMLCanvasElement|null>(null);

    // Debounce updates.
    useEffect(() => {
        const update = setTimeout(() => backend.setSource(source), 100);
        return () => clearTimeout(update);
    }, [ backend, source ]);

    const setCanvas = (canvas: HTMLCanvasElement | null) => {
        if (canvas === null || Object.is(canvas, canvasRef.current))
            return;

        backend.init(canvas);
        backend.setSource(source);
        canvasRef.current = canvas;
    };

    useEffect(() => backend.setSize(size), [ backend, size ]);

    return <canvas ref={setCanvas} />;

}
