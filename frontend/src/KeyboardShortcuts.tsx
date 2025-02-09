import { useEffect, useMemo, useRef } from "react";

import { KEY_NAMES } from "./tooltips";

import styles from "./dialog.module.css";

interface Props {
    onClose(): void;
}

interface KeyShortcut {
    label: string;
    keys: string;
}

export default function KeyboardShortcuts({ onClose }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    const shortcuts = useMemo(() => {
        const shortcuts: KeyShortcut[] = [];
        for (const el of document.body.querySelectorAll<HTMLElement>("button[data-shortcut]")) {
            const label = el.ariaLabel;
            const keys = el.dataset.shortcut;

            if (label && keys)
                shortcuts.push({ label, keys });
        }

        shortcuts.sort((a, b) => a.label.localeCompare(b.label));

        return shortcuts;
    }, []);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null)
            return;

        dialog.showModal();
        (dialog.querySelector("button:last-child") as HTMLButtonElement)?.focus();
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className={styles.modal}
            onClose={onClose}
        >
            <div className={styles.mainLayout}>
                <div className={styles.front}>
                    <h1>Keyboard<br />Shortcuts</h1>
                </div>


                <div className={styles.content}>
                    <table>
                        <tbody>
                            { shortcuts.map(s => <Shortcut key={s.keys} {...s} />) }
                        </tbody>
                    </table>

                    <div className={styles.actions}>
                        <button className={styles.close} onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </dialog>
    );
}

function Shortcut({ keys, label }: KeyShortcut ) {
    return (
        <tr>
            <td>{label}</td>
            <td className="kb-shortcut" style={{textAlign: "left"}}>
                { keys
                    .split("-")
                    .map((k, i) => <span key={i}>{` ${KEY_NAMES[k] ?? k}`}</span>)
                }
            </td>
        </tr>
    );
}
