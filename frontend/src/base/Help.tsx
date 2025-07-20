import ModalWindow from "./ModalWindow";

import styles from "../base/dialog.module.css";

interface Props {
    onClose(): void;
}

export const DOCS = {
    Language: {
        label: "Language Reference",
        href: "langref",
        desc: "Syntax and instructions supported by drawvg.",
    },
    Playground: {
        label: "Playground Help",
        href: "manual",
        desc: "A guide to the features of this playground.",
    },
} as const;

export default function Help({ onClose }: Props) {
    return (
        <ModalWindow title="Help" onClose={onClose}>
            <HelpItem {...DOCS.Language} />
            <HelpItem {...DOCS.Playground} />

            <div className={styles.actions}>
                <button className={styles.close} onClick={onClose}>Close</button>
            </div>
        </ModalWindow>
    );
}

function HelpItem({ label, href, desc }: { label: string, href: string, desc: string }) {
    return (
        <a
            href={`${import.meta.env.BASE_URL}docs/${href}.html`}
            target="_blank"
            className="block-link"
            rel="noopener noreferrer"
        >
            <span className="label">{label}</span>
            <span className="desc">{desc}</span>
        </a>
    );
}
