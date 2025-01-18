import { useCallback, useEffect, useRef, useState } from "react";

import RenderView from "./RenderView";

import styles from "./main.module.css";
import Backend from "../backend";

interface Props {
    source: string;
}

export default function OutputPanel({ source }: Props) {

    const [ canvasSize, setCanvasSize ] = useState<[number, number]>([320, 240]);

    const [ fitRenderView, setFitRenderView ] = useState(true);

    const [ playing, setPlaying ] = useState(false);

    const containerRef = useRef<HTMLDivElement|null>(null);

    const resizeHandler = useCallback(
        () => {
            if (!fitRenderView)
                return;

            const rect = containerRef.current!.getBoundingClientRect();
            setCanvasSize([Math.floor(rect.width), Math.floor(rect.height)]);
        },
        [ fitRenderView ],
    );

    useEffect(() => {
        if (!fitRenderView || containerRef.current === null)
            return;

        const resizeObserver = new ResizeObserver(resizeHandler);
        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, [ fitRenderView, resizeHandler ]);

    useEffect(() => Backend.setPlaying(playing), [ playing ]);

    return (
        <div className={styles.output}>
            <div className={styles.settings}>
                <label> <input
                    type="checkbox"
                    checked={fitRenderView}
                    onChange={e => setFitRenderView(e.target.checked)}
                /> Fit</label>

                <label> <input
                    type="checkbox"
                    checked={playing}
                    onChange={e => setPlaying(e.target.checked)}
                /> Playing</label>

                <button
                    onClick={() => Backend.sendAction("ResetPlayback") }
                >Reset Playback</button>

                { !playing &&
                    <button
                        onClick={() => Backend.sendAction("NextFrame") }
                    >Next frame</button>
                }
            </div>

            <div
                ref={containerRef}
                data-fit-render={fitRenderView ? "1" : "0"}
                className={styles.renderView}
            >
                <RenderView source={source} size={canvasSize} />
            </div>
        </div>
    );
}
