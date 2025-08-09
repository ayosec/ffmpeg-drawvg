import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { BsFillSkipBackwardFill } from "react-icons/bs";
import { IoCamera, IoPause, IoPlay, IoPlaySkipBack, IoPlaySkipForward, IoVideocam } from "react-icons/io5";

import IconButton from "../base/IconButton";
import RenderView from "./RenderView";

import BackendContext from "../BackendContext";
import Select from "../base/Select";
import VideoExport from "./video/VideoExport";
import useAppLayout, { Layout } from "../base/layout";
import { downloadBlob } from "../utils/blobs";

import styles from "./output.module.css";

enum PlaybackStatus {
    Pause,
    Forward,
    Backwards,
}

const CANVAS_FIXED_SIZES: [ number, number][] = [
    [ 1024, 768 ],
    [ 640, 480 ],
    [ 200, 200 ],
];

const PLAYBACK_SPEEDS: [ number, string ][] =
    [ 0.1, 0.25, 0.5, 1, 1.25, 1.5, 2, 4 ].map(x => [ x, `${x}` ]);

export default function OutputPanel() {
    const backend = useContext(BackendContext);

    const appLayout = useAppLayout(s => s.layout);

    const [ canvasSize, setCanvasSize ] = useState<[number, number]>([320, 240]);

    const [ openVideoExport, setOpenVideoExport ] = useState(false);

    const [ fitRenderView, setFitRenderView ] = useState(true);

    const [ playbackSpeed, setPlaybackSpeed ] = useState(1);

    const [ playing, setPlaying ] = useState(PlaybackStatus.Pause);

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
        () => {
            const factor = playing === PlaybackStatus.Backwards ? -1 : 1;
            backend.setPlaying(playing !== PlaybackStatus.Pause, playbackSpeed * factor);
        },
        [ backend, playing, playbackSpeed ],
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
        if (size[0] === canvasSize[0] && size[1] === canvasSize[1])
            needCurrentSize = false;

        canvasSizeOptions.push([ [ false, size ], size.join("×")]);
    }

    if (needCurrentSize)
        canvasSizeOptions.splice(1, 0, [ [ false, canvasSize ], "Keep current size" ]);

    return (
        <div
            className={styles.output}
            data-fixed-height-render={!fitRenderView && appLayout == Layout.Vertical ? "true" : undefined}
        >
            <div role="toolbar" className={styles.toolbar}>
                <div>
                    <Select
                        title="Frame Size"
                        value={[fitRenderView, canvasSize]}
                        valueLabel={canvasSize.join("×")}
                        onChange={configureCanvasSize}
                        options={canvasSizeOptions}
                        optionsAlign="left"
                    />
                </div>

                <div>
                    <IconButton
                        Icon={BsFillSkipBackwardFill}
                        label="Reset Playback"
                        shortcut="ctrl-e"
                        onClick={() => backend.sendAction("ResetPlayback") }
                    />

                    <IconButton
                        Icon={IoPlaySkipBack}
                        label="Previous Frame"
                        shortcut="ctrl-,"
                        onClick={() => {
                            setPlaying(PlaybackStatus.Pause);
                            backend.sendAction("PreviousFrame");
                        }}
                    />

                    { playing === PlaybackStatus.Backwards
                        ?
                            <IconButton
                                Icon={IoPause}
                                label="Pause Animation"
                                shortcut="ctrl-shift- "
                                onClick={() => setPlaying(PlaybackStatus.Pause)}
                            />
                        :
                            <IconButton
                                Icon={IoPlay}
                                iconStyle={{transform: "scaleX(-1)"}}
                                label="Play Backwards"
                                shortcut="ctrl-shift- "
                                onClick={() => setPlaying(PlaybackStatus.Backwards)}
                            />
                    }

                    <Select
                        title="Playback Speed"
                        value={playbackSpeed}
                        valueLabel={playbackSpeed + "x"}
                        onChange={setPlaybackSpeed}
                        options={PLAYBACK_SPEEDS}
                    />

                    { playing === PlaybackStatus.Forward
                        ?
                            <IconButton
                                Icon={IoPause}
                                label="Pause Animation"
                                shortcut="ctrl- "
                                onClick={() => setPlaying(PlaybackStatus.Pause)}
                            />
                        :
                            <IconButton
                                Icon={IoPlay}
                                label="Play Forwards"
                                shortcut="ctrl- "
                                onClick={() => setPlaying(PlaybackStatus.Forward)}
                            />
                    }

                    <IconButton
                        Icon={IoPlaySkipForward}
                        label="Next Frame"
                        shortcut="ctrl-."
                        onClick={() => {
                            setPlaying(PlaybackStatus.Pause);
                            backend.sendAction("NextFrame");
                        }}
                    />
                </div>

                <div>
                    <IconButton
                        Icon={IoCamera}
                        label="Export to Image"
                        onClick={() => saveToImage(containerRef.current)}
                    />

                    <IconButton
                        Icon={IoVideocam}
                        label="Export to Video"
                        onClick={() => setOpenVideoExport(true)}
                    />
                </div>
            </div>

            <div
                ref={containerRef}
                data-fit-render={fitRenderView ? "1" : "0"}
                className={styles.renderView}
                onClick={e => {
                    setPlaying(playing === PlaybackStatus.Pause
                        ? PlaybackStatus.Forward
                        : PlaybackStatus.Pause
                    );

                    e.preventDefault();
                }}
            >
                <RenderView size={canvasSize} />
            </div>

            {
                openVideoExport &&
                    <VideoExport
                        size={canvasSize}
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

        downloadBlob(blob, "vgs-%NOW.png");
    });
}
