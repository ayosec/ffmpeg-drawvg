import { useCallback, useEffect, useRef, useState } from "react";

import { BsFillSkipBackwardFill } from "react-icons/bs";
import { HiLockClosed } from "react-icons/hi";
import { IoCamera, IoExpand, IoPause, IoPlay, IoPlaySkipBack, IoPlaySkipForward, IoVideocam } from "react-icons/io5";

import Icon from "../Icon";
import RenderView from "./RenderView";
import styles from "./Output.module.css";

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
            <div className={styles.toolbar}>
                <div>
                    { fitRenderView &&
                        <Icon
                            icon={HiLockClosed}
                            label="Fix canvas size"
                            onClick={() => setFitRenderView(!fitRenderView)}
                        />
                    }

                    { !fitRenderView &&
                        <Icon
                            icon={IoExpand}
                            label="Adjust canvas size to panel"
                            onClick={() => setFitRenderView(!fitRenderView)}
                        />
                    }

                    <div className={styles.canvasSize}>{ canvasSize.join("×") }</div>
                </div>

                <div>
                    <Icon
                        icon={BsFillSkipBackwardFill}
                        label="Reset playback"
                        onClick={() => Backend.sendAction("ResetPlayback") }
                    />

                    <Icon
                        icon={IoPlaySkipBack}
                        label="Next frame"
                        onClick={() => {
                            setPlaying(false);
                            Backend.sendAction("PreviousFrame");
                        }}
                    />

                    { playing
                        ?
                            <Icon
                                icon={IoPause}
                                label="Pause animation"
                                onClick={() => setPlaying(!playing)}
                            />
                        :
                            <Icon
                                icon={IoPlay}
                                label="Play animation"
                                onClick={() => setPlaying(!playing)}
                            />
                    }

                    <Icon
                        icon={IoPlaySkipForward}
                        label="Previous frame"
                        onClick={() => {
                            setPlaying(false);
                            Backend.sendAction("NextFrame");
                        }}
                    />
                </div>

                <div>
                    <Icon
                        icon={IoCamera}
                        label="Export to image"
                        onClick={() => { console.log("TODO"); }}
                    />

                    <Icon
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
