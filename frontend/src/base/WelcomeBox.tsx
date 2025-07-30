import { useState } from "react";

import Help from "./Help";
import useAppLayout, { Layout } from "./layout";
import useCurrentProgram from "../currentProgram";
import useExamplesGallery from "../gallery/state";

import styles from "../base/dialog.module.css";

const CLOSE_KEY = "welcome/closed";

// When the box is closed with the button (instead of being automatically
// closed when the source is not empty), store the action in `localStorage`,
// so the box will not be open again.
const SKIP_WELCOME = localStorage.getItem(CLOSE_KEY) === "1";

export default function WelcomeBox() {
    const source = useCurrentProgram(s => s.source);

    const setGalleryOpen = useExamplesGallery(s => s.setOpen);

    const layout = useAppLayout(s => s.layout);

    const [ isClosed, setIsClosed ] = useState(SKIP_WELCOME);

    if (
        isClosed
            || layout === Layout.Vertical
            || source !== ""
    ) {
        return <></>;
    }

    const close = () => {
        localStorage.setItem(CLOSE_KEY, "1");
        setIsClosed(true);
    };

    return (
        <div className={styles.welcomeBox}>
            <div className={styles.front}>
                <div className={styles.title}>
                    Getting Started
                </div>

                <div className={styles.actions}>
                    <button className={styles.close} onClick={close}>Close</button>
                </div>
            </div>

            <div className={styles.content}>
                <a
                    onClick={() => setGalleryOpen(true)}
                    target="_blank"
                    className="block-link"
                    rel="noopener noreferrer"
                >
                    <span className="label">Examples Gallery</span>
                    <span className="desc">Load an example script.</span>
                </a>

                <Help.Item kind="Language" />
                <Help.Item kind="Playground" />
            </div>
        </div>
    );
}
