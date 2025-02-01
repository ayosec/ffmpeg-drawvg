import { deflate } from "pako";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "../dialog.module.css";
import editorStyles from "./editor.module.css";

interface Props {
    source: string;
    onClose(): void;
}

function makeHash(source: string) {
    const zip = deflate(source, { level: 9 });
    if ((zip as any).toBase64) {
        return (zip as any).toBase64();
    }

    return btoa(String.fromCodePoint(...zip));
}

export default function Share({ source, onClose }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    const [ copyFinished, setCopyFinished ]  = useState(false);

    const shareURL = useMemo(() => {
        const url = new URL(location.href);
        url.hash = "zip=" + encodeURIComponent(makeHash(source));
        return url.toString();
    }, [ source ]);

    useEffect(() => { dialogRef.current?.showModal(); }, []);

    useEffect(() => {
        if (copyFinished)
            setTimeout(() => setCopyFinished(false), 1500);
    }, [ copyFinished ]);

    const copyHandler = useCallback(() => {
        if (copyFinished)
            return;

        navigator.clipboard
            .writeText(shareURL)
            .then(() => setCopyFinished(true));
    }, [ copyFinished, shareURL ]);

    return (
        <dialog
            ref={dialogRef}
            className={styles.modal}
            onClose={onClose}
        >
            <div className={styles.mainLayout}>
                <div className={styles.front}>
                    <h1>Share</h1>
                </div>

                <div className={styles.content}>
                    Use this URL to share the current script:

                    <input
                        className={editorStyles.shareWidget}
                        readOnly={true}
                        defaultValue={shareURL}
                    />

                    <div className={styles.actions}>
                        <button className={styles.close} onClick={onClose}>Close</button>

                        { navigator.clipboard &&
                            <button onClick={copyHandler}>
                                { copyFinished ? "Copied!" : "Copy" }
                            </button>
                        }
                    </div>

                </div>
            </div>

        </dialog>
    );
}
