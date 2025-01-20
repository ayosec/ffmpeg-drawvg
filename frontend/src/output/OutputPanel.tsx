import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { BsFillSkipBackwardFill } from "react-icons/bs";
import { HiLockClosed } from "react-icons/hi";
import { IoCamera, IoExpand, IoPause, IoPlay, IoPlaySkipBack, IoPlaySkipForward, IoVideocam } from "react-icons/io5";

import IconButton from "../IconButton";
import RenderView from "./RenderView";
import styles from "./Output.module.css";

import BackendContext from "../backend";

interface Props {
    source: string;
}

export default function OutputPanel({ source }: Props) {

    const backend = useContext(BackendContext);

    const [ canvasSize, setCanvasSize ] = useState<[number, number]>([320, 240]);

    const [ fitRenderView, setFitRenderView ] = useState(true);

    const lastFitRenderView = useRef(fitRenderView);

    const [ playing, setPlaying ] = useState(false);

    const containerRef = useRef<HTMLDivElement|null>(null);

    const canvasSizeInfoRef = useRef<HTMLDivElement|null>(null);

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

    useEffect(
        () => backend.setPlaying(playing),
        [ playing ],
    );

    useEffect(() => {
        if (lastFitRenderView.current === fitRenderView
            || canvasSizeInfoRef.current === null
        ) {
            return;
        }

        // When the `fitRenderView` option is modified, use a blink effect
        // on the canvas size, so the user can see that the option affects
        // its value.

        lastFitRenderView.current = fitRenderView;

        let animation: Animation|null = canvasSizeInfoRef.current.animate(
            [
              { opacity: "unset" },
              { opacity: "0" },
              { opacity: "unset" },
            ], {
              duration: 500,
              easing: "ease",
              iterations: 1,
            });

        animation.addEventListener("finish", () => { animation = null; });

        return () => animation?.finish();
    }, [ fitRenderView ]);

    return (
        <div className={styles.output}>
            <div className={styles.toolbar}>
                <div>
                    <IconButton
                        icon={fitRenderView ? IoExpand : HiLockClosed}
                        label={
                            (
                                fitRenderView
                                    ? "Canvas size fits the panel"
                                    : "Canvas size is fixed"
                            ) + ".\nClick to toggle"
                        }
                        onClick={() => setFitRenderView(!fitRenderView)}
                    />

                    <div
                        ref={canvasSizeInfoRef}
                        className={styles.canvasSize}
                    >
                        { canvasSize.join("×") }
                    </div>
                </div>

                <div>
                    <IconButton
                        icon={BsFillSkipBackwardFill}
                        label="Reset playback"
                        onClick={() => backend.sendAction("ResetPlayback") }
                    />

                    <IconButton
                        icon={IoPlaySkipBack}
                        label="Next frame"
                        onClick={() => {
                            setPlaying(false);
                            backend.sendAction("PreviousFrame");
                        }}
                    />

                    { playing
                        ?
                            <IconButton
                                icon={IoPause}
                                label="Pause animation"
                                onClick={() => setPlaying(!playing)}
                            />
                        :
                            <IconButton
                                icon={IoPlay}
                                label="Play animation"
                                onClick={() => setPlaying(!playing)}
                            />
                    }

                    <IconButton
                        icon={IoPlaySkipForward}
                        label="Previous frame"
                        onClick={() => {
                            setPlaying(false);
                            backend.sendAction("NextFrame");
                        }}
                    />
                </div>

                <div>
                    <IconButton
                        icon={IoCamera}
                        label="Export to image"
                        onClick={() => { console.log("TODO"); }}
                    />

                    <IconButton
                        icon={IoVideocam}
                        label="Export to video"
                        onClick={() => { console.log("TODO"); }}
                    />
                </div>
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
