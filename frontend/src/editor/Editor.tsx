import { useRef } from "react";

import styles from "./Editor.module.css";
import Highlights from "./Highlights";

interface Props {
    source: string,
    setSource(source: string): void;
}

export default function Editor({ source, setSource }: Props) {

    const highlightsRef = useRef<HTMLPreElement|null>(null);

    const onScroll: React.UIEventHandler<HTMLElement> = event => {
        requestAnimationFrame(() => {
            const hl = highlightsRef.current;
            const editor = event.target;

            if (hl !== null && editor instanceof HTMLElement) {
                hl.scrollTop = editor.scrollTop;
                hl.scrollLeft = editor.scrollLeft;
            }
        });
    };

    return (
        <div className={styles.editor}>
            <Highlights ref={highlightsRef} source={source} />

            <textarea
                value={source}
                spellCheck="false"
                autoFocus={true}
                onScroll={onScroll}
                onChange={e => setSource(e.target.value)}
            />
        </div>
    );
}
