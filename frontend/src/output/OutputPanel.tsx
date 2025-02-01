import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { BsFillSkipBackwardFill } from "react-icons/bs";
import { IoCamera, IoPause, IoPlay, IoPlaySkipBack, IoPlaySkipForward, IoVideocam } from "react-icons/io5";

import IconButton from "../IconButton";
import RenderView from "./RenderView";
import styles from "./output.module.css";

import BackendContext from "../backend";
import Select from "../Select";
import VideoExport from "./video/VideoExport";

interface Props {
    source: string;
}

const CANVAS_FIXED_SIZES: [ number, number][] = [
    [ 1024, 768 ],
    [ 640, 480 ],
    [ 200, 200 ],
];

export default function OutputPanel({ source }: Props) {
    const backend = useContext(BackendContext);

    const [ canvasSize, setCanvasSize ] = useState<[number, number]>([320, 240]);

    const [ openVideoExport, setOpenVideoExport ] = useState(false);

    const [ fitRenderView, setFitRenderView ] = useState(true);

    // TODO: play backwards
    const [ playing, setPlaying ] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

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
        [ backend, playing ],
    );

    const configureCanvasSize = ([fit, cs]: [boolean, [number, number]]) => {
        if (fit) {
            setFitRenderView(true);
        } else {
            setFitRenderView(false);
            setCanvasSize(cs);
        }
    };

    const canvasSizeOptions: [ [ boolean, [ number, number ] ], string ][] = [
        [ [ true, canvasSize ], "Fit to panel size" ],
    ];

    let needCurrentSize = true;

    for (const size of CANVAS_FIXED_SIZES) {
        if (size[0] == canvasSize[0] && size[1] == canvasSize[1])
            needCurrentSize = false;

        canvasSizeOptions.push([ [ false, size ], size.join("×")]);
    }

    if (needCurrentSize)
        canvasSizeOptions.splice(1, 0, [ [ false, canvasSize ], "Keep current size" ]);

    return (
        <div className={styles.output}>
            <div className={styles.toolbar}>
                <div>
                    <Select
                        value={[fitRenderView, canvasSize]}
                        valueLabel={canvasSize.join("×")}
                        onChange={configureCanvasSize}
                        options={canvasSizeOptions}
                    />
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
                                label="Play forward"
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
                        onClick={() => saveToImage(containerRef.current)}
                    />

                    <IconButton
                        icon={IoVideocam}
                        label="Export to video"
                        onClick={() => setOpenVideoExport(true)}
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

            {
                openVideoExport &&
                    <VideoExport
                        size={canvasSize}
                        source={source}
                        onClose={() => setOpenVideoExport(false)}
                    />
            }
        </div>
    );
}

function saveToImage(ref: HTMLDivElement|null) {
    ref?.querySelector("canvas")?.toBlob(blob => {
        if (blob === null) {
            console.error("Unable to get the image from the canvas.");
            return;
        }

        const url = URL.createObjectURL(blob);
        try {
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "vgs.png";
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
        } finally {
            URL.revokeObjectURL(url);
        }
    });
}
