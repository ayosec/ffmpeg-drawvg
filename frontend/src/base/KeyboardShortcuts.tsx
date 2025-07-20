import { useMemo } from "react";

import ModalWindow from "./ModalWindow";
import { KEY_NAMES } from "./tooltips";
import { capitalize } from "../utils/strings";

import styles from "../base/dialog.module.css";

interface Props {
    onClose(): void;
}

interface KeyShortcut {
    label: string;
    keys: string;
}

export default function KeyboardShortcuts({ onClose }: Props) {
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

    return (
        <ModalWindow title={<h1>Keyboard<br />Shortcuts</h1>} onClose={onClose}>
            <table>
                <tbody>
                    { shortcuts.map(s => <Shortcut key={s.keys} {...s} />) }
                </tbody>
            </table>

            <div className={styles.actions}>
                <button className={styles.close} onClick={onClose}>Close</button>
            </div>
        </ModalWindow>
    );
}

function Shortcut({ keys, label }: KeyShortcut ) {
    return (
        <tr>
            <td>{label}</td>
            <td className="kb-shortcut" style={{textAlign: "left"}}>
                { keys
                    .split("-")
                    .map((k, i) => <span key={i}>{capitalize(KEY_NAMES[k] ?? k)}</span>)
                }
            </td>
        </tr>
    );
}
