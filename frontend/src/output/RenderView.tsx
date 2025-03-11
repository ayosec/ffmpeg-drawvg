import { useContext, useEffect, useRef } from "react";

import useCurrentProgram from "../currentProgram";
import BackendContext from "../BackendContext";

interface Props {
    size: [number, number];
};

export default function RenderView({ size }: Props) {
    const programId = useCurrentProgram(s => s.programId);
    const source = useCurrentProgram(s => s.source);

    const backend = useContext(BackendContext);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Debounce updates.
    useEffect(() => {
        const update = setTimeout(() => backend.setProgram(programId, source), 200);
        return () => clearTimeout(update);
    }, [ backend, programId, source ]);

    const setCanvas = (canvas: HTMLCanvasElement | null) => {
        if (canvas === null || Object.is(canvas, canvasRef.current))
            return;

        backend.init(canvas, size);
        backend.setProgram(programId, source);

        canvasRef.current = canvas;
    };

    useEffect(
        () => { backend.setSize(size); },
        [ backend, size ],
    );

    return <canvas ref={setCanvas} />;

}
