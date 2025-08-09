import { useLayoutEffect, useRef } from "react";

import { insertSuggestion, Props } from "./completion.impl";

import styles from "./editor.module.css";

export default function Completion(props: Props) {
    const { selected, currentWord, suggestions } = props;

    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const box = ref.current;

        // Put the menu next to the <span> of the current word.

        const span = box
            ?.closest("[data-panel='editor']")
            ?.querySelector(`pre span[data-offset="${currentWord.start}"]`);

        if (box === null || !span)
            return;

        const boxRect = box.getBoundingClientRect();
        const spanRect = span.getBoundingClientRect();

        const spanBottom = spanRect.top + spanRect.height;
        if (spanBottom + boxRect.height < window.innerHeight)
            box.style.top = spanBottom + "px";
        else
            box.style.top = spanRect.top - boxRect.height + "px";

        box.style.left = spanRect.left + "px";


        // Ensure the selected option is visible.
        box.getElementsByClassName(styles.selected)[0]
            ?.scrollIntoView({ block: "nearest" });
    });

    return (
        <div ref={ref} className={styles.suggestions}>
            {
                suggestions.map((s, i) => (
                    <div
                        key={s.text}
                        onMouseDown={() => insertSuggestion({...props, selected: i})}
                        className={i === selected ? styles.selected : undefined}
                    >
                        <span>{s.text}</span>

                        {
                            s.color &&
                                <span className={styles.color} style={{background: s.color}}></span>
                        }

                        {
                            s.params &&
                                <span className={styles.params}>{s.params.join(" ")}</span>
                        }
                    </div>
                ))
            }
        </div>
    );
}
