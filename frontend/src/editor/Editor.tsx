import { useRef } from "react";

import styles from "./Editor.module.css";
import Highlights from "./Highlights";

interface Props {
    autoFocus?: boolean,
    source: string,
    setSource(source: string): void;
}

export default function Editor({ autoFocus, source, setSource }: Props) {

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
                autoFocus={autoFocus}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                onScroll={onScroll}
                onChange={e => setSource(e.target.value)}
            />
        </div>
    );
}
