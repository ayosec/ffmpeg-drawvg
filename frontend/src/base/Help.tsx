import { useEffect, useRef } from "react";

import styles from "../base/dialog.module.css";

interface Props {
    onClose(): void;
}

export const DOCS = {
    Language: {
        label: "Language Reference",
        href: "TODO",
        desc: "Syntax and instructions supported by drawvg.",
    },
    Playground: {
        label: "Playground Help",
        href: "TODO",
        desc: "A guide to the features of this playground.",
    },
} as const;

export default function Help({ onClose }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null)
            return;

        dialog.showModal();
        dialog.querySelector<HTMLButtonElement>("button:last-child")?.focus();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className={styles.modal}
            onClose={onClose}
        >

            <div className={styles.mainLayout}>
                <div className={styles.front}>
                    <h1>Help</h1>
                </div>

                <div className={styles.content}>
                    <HelpItem {...DOCS.Language} />
                    <HelpItem {...DOCS.Playground} />

                    <div className={styles.actions}>
                        <button className={styles.close} onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </dialog>
    );
}

function HelpItem({ label, href, desc }: { label: string, href: string, desc: string }) {
    return (
        <a
            href={href}
            target="_blank"
            className="block-link"
            rel="noopener noreferrer"
        >
            <span className="label">{label}</span>
            <span className="desc">{desc}</span>
        </a>
    );
}
