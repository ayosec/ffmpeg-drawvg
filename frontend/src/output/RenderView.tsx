import { useContext, useEffect, useRef } from "react";

import BackendContext from "../backend";
import { Program } from "../render/protocol";

interface Props {
    program: Program;
    size: [number, number];
};

export default function RenderView({ program, size }: Props) {

    const backend = useContext(BackendContext);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Debounce updates.
    useEffect(() => {
        const update = setTimeout(() => backend.setProgram(program.id, program.source), 200);
        return () => clearTimeout(update);
    }, [ backend, program ]);

    const setCanvas = (canvas: HTMLCanvasElement | null) => {
        if (canvas === null || Object.is(canvas, canvasRef.current))
            return;

        backend.init(canvas);
        backend.setProgram(program.id, program.source);
        canvasRef.current = canvas;
    };

    useEffect(() => backend.setSize(size), [ backend, size ]);

    return <canvas ref={setCanvas} />;

}
