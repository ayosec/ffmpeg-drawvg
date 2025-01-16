import { useEffect, useRef } from "react";

import Backend from "./backend";

interface Props {
    source: string;
    size: [number, number];
};

export default function RenderView({ source, size }: Props) {

    const canvasRef = useRef<HTMLCanvasElement|null>(null);

    // Debounce updates.
    useEffect(() => {
        const update = setTimeout(() => Backend.setSource(source), 100);
        return () => clearTimeout(update);
    }, [ source ]);

    const setCanvas = (canvas: HTMLCanvasElement | null) => {
        if (canvas === null || Object.is(canvas, canvasRef.current))
            return;

        Backend.init(canvas);
        Backend.setSource(source);
        canvasRef.current = canvas;
    };

    useEffect(() => Backend.setSize(size), [ size ]);

    return <canvas ref={setCanvas} />;

}
