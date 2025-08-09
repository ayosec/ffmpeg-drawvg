import { DeflateOptions, deflate } from "pako";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ModalWindow from "../base/ModalWindow";
import base64 from "../utils/base64";

import styles from "../base/dialog.module.css";
import editorStyles from "./editor.module.css";

interface Props {
    name: string;
    source: string;
    onClose(): void;
}

function makeHash(name: string, source: string) {
    // The source is compressed with zlib, and encoded as base64.
    //
    // The original source can be obtained from the URL with:
    //
    //  $ echo "$URL" \
    //      | perl -pe 's/.*gzip=//; s/%(..)/chr(hex($1))/ge' \
    //      | base64 -d \
    //      | gzip -dc

    const options: DeflateOptions = {
        level: 9,
        gzip: true,
        header: {
            name: `${name}.txt`,
            text: true,
        },
    };

    const zip = deflate(source, options);
    return base64.encode(zip);
}

export default function Share({ name, source, onClose }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);

    const [ copyFinished, setCopyFinished ] = useState(false);

    const shareURL = useMemo(() => {
        const hash = makeHash(name, source);
        const url = new URL(location.href);
        url.hash = "gzip=" + encodeURIComponent(hash);
        return url.toString();
    }, [ name, source ]);

    useEffect(() => {
        if (copyFinished)
            setTimeout(() => setCopyFinished(false), 1500);
    }, [ copyFinished ]);

    const copyHandler = useCallback(() => {
        if (copyFinished)
            return;

        inputRef.current?.animate(
            [
                {},
                { boxShadow: "0 0 20px" },
                {},
            ], {
                duration: 500,
                easing: "ease-out",
                iterations: 1,
            });

        navigator.clipboard
            .writeText(shareURL)
            .then(() => setCopyFinished(true));
    }, [ copyFinished, shareURL ]);

    return (
        <ModalWindow title="Share" onClose={onClose}>
            Use this URL to share the current script:

            <input
                ref={inputRef}
                className={editorStyles.shareWidget}
                readOnly={true}
                defaultValue={shareURL}
            />

            <div className={styles.actions}>
                <button className={styles.close} onClick={onClose}>Close</button>

                { navigator.clipboard
                    ?
                        <button onClick={copyHandler}>
                            { copyFinished ? "Copied!" : "Copy" }
                        </button>
                    :
                        <button disabled aria-label="Clipboard not available">
                            Copy
                        </button>
                }
            </div>
        </ModalWindow>
    );
}
