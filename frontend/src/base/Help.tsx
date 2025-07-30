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

type DocKind = keyof typeof DOCS;

export default function Help({ onClose }: Props) {
    return (
        <ModalWindow title="Help" onClose={onClose}>
            <Help.Item kind="Language" />
            <Help.Item kind="Playground" />

            <div className={styles.actions}>
                <button className={styles.close} onClick={onClose}>Close</button>
            </div>
        </ModalWindow>
    );
}

Help.Item = ({ kind }: { kind: DocKind }) => {
    const { label, desc } = DOCS[kind];

    return (
        <a
            href={Help.docURL(kind)}
            target="_blank"
            className="block-link"
            rel="noopener noreferrer"
        >
            <span className="label">{label}</span>
            <span className="desc">{desc}</span>
        </a>
    );
};

Help.docURL = (kind: DocKind) => (
    `${import.meta.env.BASE_URL}docs/${DOCS[kind].href}.html`
);
