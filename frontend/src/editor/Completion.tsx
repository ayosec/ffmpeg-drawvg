import { Instructions } from "@backend/syntax";

import styles from "./editor.module.css";
import { useLayoutEffect, useRef } from "react";

interface CurrentWord {
    caret: number;
    word: string;
    start: number;
}

export interface Props {
    selected: number;
    textarea: HTMLTextAreaElement;
    currentWord: CurrentWord;
    suggestions: string[]
}

export function Suggestions(props: Props) {
    const { selected, currentWord, suggestions } = props;

    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const box = ref.current;

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
    });

    return (
        <div ref={ref} className={styles.suggestions}>
            {
                suggestions.map((s, i) => (
                    <div
                        key={s}
                        onMouseDown={() => insertSuggestion({...props, selected: i})}
                        className={i === selected ? styles.selected : undefined}
                    >
                        {s}
                    </div>
                ))
            }
        </div>
    );
}

export function configure(textarea: HTMLTextAreaElement): Props|null {
    const cw = getCurrentWord(textarea);

    if (cw.word === "")
        return null;

    return tryInstructions(textarea, cw);
}

export function onKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    props: Props
): [ boolean, Props|null] {
    switch (event.key) {
        case "Escape":
            return [ true, null ];

        case "ArrowUp":
            return [
                true,
                {
                    ...props,
                    selected: props.selected > 0
                                ? props.selected - 1
                                : props.suggestions.length - 1
                },
            ];

        case "ArrowDown":
            return [
                true,
                {
                    ...props,
                    selected: (props.selected + 1) % props.suggestions.length
                },
            ];

        case "Tab":
        case "Enter":
            insertSuggestion(props);
            return [ true, null ];

        default:
            return [ false, null ];
    }
}

function getCurrentWord(textarea: HTMLTextAreaElement): CurrentWord {
    const source = textarea.value;
    const caret = textarea.selectionStart;

    // Extract word under the cursor.

    let bow = caret;
    while (bow > 0) {
        if (source.charCodeAt(bow - 1) < 33)
            break;

        bow--;
    }

    let eow = caret;
    while (eow < source.length) {
        if (source.charCodeAt(eow) < 33)
            break;

        eow++;
    }

    return {
        caret,
        word: source.slice(bow, eow),
        start: bow,
    };
}

function tryInstructions(textarea: HTMLTextAreaElement, cw: CurrentWord): Props|null {
    const suggestions = [];
    for (const i of Instructions) {
        if (i !== cw.word && i.startsWith(cw.word))
            suggestions.push(i);
    }

    if (suggestions.length === 0)
        return null;

    suggestions.sort();

    return {
        textarea,
        suggestions,
        selected: 0,
        currentWord: cw,
    }
}

function insertSuggestion(props: Props) {
    requestAnimationFrame(() => {
        const { textarea, currentWord } = props;

        const insert = props.suggestions[props.selected] + " ";

        textarea.focus();
        textarea.setSelectionRange(currentWord.start, currentWord.start + currentWord.word.length);
        (document as any).execCommand("insertText", false, insert);
    });
}
