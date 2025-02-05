import { useContext, useEffect, useRef, useState } from "react";

import BackendContext from "../../backend";

import styles from "../../dialog.module.css";
import outputStyles from "../output.module.css";
import Configure from "./Configure";

interface Props {
    size: [ number, number ];
    source: string;
    onClose: () => void;
};

export interface Configuration {
    frameCount: number;
    encoderConfig: VideoEncoderConfig;
}

interface ExportProcessProps {
    config: Configuration;
    source: string,
    onClose: () => void;
}

type Process
    = { state: "config" }
    | { state: "export", config: Configuration }
    ;

export default function VideoExport({ size, source, onClose }: Props) {
    const [ process, setProcess ] = useState<Process>({ state: "config" });

    if (process.state === "export") {
        return (
            <ExportProcess config={process.config} source={source} onClose={onClose} />
        );
    } else {
        return (
            <Configure
                size={size}
                onClose={onClose}
                setConfig={config => setProcess({ state: "export", config })}
            />
        );
    }
}

function ExportProcess({ config, source, onClose }: ExportProcessProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    const backend = useContext(BackendContext);

    const [ progress, setProgress ] = useState(0);

    const [ summary, setSummary ] = useState(<></>);

    const [ failure, setFailure ] = useState<string|null>(null);

    const [ objectURL, setObjectURL ] = useState<string|null>(null);

    useEffect(() => { dialogRef.current?.showModal(); }, []);

    useEffect(() => {
        const task = backend.exportVideo(
            {
                frames: config.frameCount,
                encoderConfig: config.encoderConfig,
                source,
            },
            {
                onError: setFailure,
                onProgress: setProgress,
                onFinish(objectURL: string, size: number, duration: number) {
                    setObjectURL(objectURL);

                    const time = duration > 180_000
                        ? `${Math.round(duration / 60_000)} minutes`
                        : `${Math.round(duration / 1000)} seconds`;

                    const fmtSize = size > (4 << 20)
                        ? `${Math.round(size / (1 << 20))} MiB`
                        : `${Math.round(size / (1 << 10))} KiB`;

                    setSummary(<><b>{fmtSize}</b> in <b>{time}</b></>);
                }
            }
        );

        return () => { task.cancel(); };
    }, [ backend, config, source ]);

    useEffect(
        () => {
            // Revoke objectURL on unmount.
            return () => {
                if (objectURL !== null)
                    URL.revokeObjectURL(objectURL);
            };
        },
        [ objectURL ],
    );


    let content;
    if (objectURL !== null) {
        content = (
            <div className={outputStyles.results}>
                <video controls src={ objectURL } />
            </div>
        );
    } else if (failure !== null) {
        content = (
            <div className={outputStyles.results}>
                <div className={styles.errors}>
                    {failure}
                </div>
            </div>
        );
    } else {
        const percent = progress / config.frameCount;

        const R = 40;
        const circumference = 2 * Math.PI * R;

        content = (
            <div className={outputStyles.exportProgress}>
                {
                    percent < 1
                        ? <span>{Math.round(100 * percent)}%</span>
                        : <span className={outputStyles.processing}>Processing ...</span>
                }

                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r={percent < 1 ? R : 0}
                        fill="none"
                        stroke="white"
                        strokeWidth="5%"
                        strokeDashoffset={circumference * (1 - percent)}
                        strokeDasharray={circumference}
                    />
                </svg>
            </div>
        );
    }

    return (
        <dialog
            ref={dialogRef}
            className={styles.modal}
            onClose={onClose}
        >
            <div className={styles.front}>
                { content }

                <div className={outputStyles.buttonBar}>
                    <div className={outputStyles.summary}>
                        { summary }
                    </div>

                    <div className={styles.actions}>
                        <button className={styles.close} onClick={onClose}>
                            { objectURL ? "Close" : "Cancel" }
                        </button>
                        {
                            objectURL &&
                                <a download="drawvg.webm" href={objectURL}>Download</a>
                        }
                    </div>
                </div>
            </div>
        </dialog>
    );
}
