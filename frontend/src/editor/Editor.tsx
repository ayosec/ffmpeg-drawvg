import { useCallback, useRef, useState } from "react";

import { IoShareSocial } from "react-icons/io5";

import CompilerError from "../vgs/CompilerError";
import Highlights from "./Highlights";
import IconButton from "../IconButton";
import Share from "./Share";
import keyMapHandler from "./keymap";
import { Program } from "../render/protocol";

import styles from "./editor.module.css";

interface Props {
    autoFocus?: boolean,
    program: Program,
    compilerError: CompilerError|null;
    setSource(source: string): void;
}

export default function Editor({ autoFocus, program, compilerError, setSource }: Props) {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const highlightsRef = useRef<HTMLPreElement>(null);

    const lastHighlightedSpan = useRef<HTMLElement>(null);

    const [ share, setShare ] = useState(false);

    const onSelect = useCallback(() => {
        const textArea = textAreaRef.current;
        const highlights = highlightsRef.current;

        if (textArea === null || highlights === null)
            return;

        const caret = getCaretPosition(program.source, textArea.selectionStart);

        // Hide error message is caret is below it.
        if (compilerError !== null) {
            const l = compilerError.line + 1;
            const visibility = (caret.line == l || caret.line == l + 1)
                ? "hidden"
                : "";

            if (highlights.dataset.alertsLastVisibility !== visibility) {
                for (const el of highlights.querySelectorAll<HTMLElement>("[role='alert']"))
                    el.style.visibility = visibility;

                highlights.dataset.alertsLastVisibility = visibility;
            }
        }

        // Set caret color to the foreground of the highlight.
        const highlightedSpan = findHighlightedSpan(highlights, caret.line, caret.column);
        if (highlightedSpan && lastHighlightedSpan.current !== highlightedSpan) {
            lastHighlightedSpan.current = highlightedSpan;
            textArea.style.caretColor = getComputedStyle(highlightedSpan).color;
        }
    }, [ compilerError, program.source ]);

    return (
        <div className={styles.editor}>
            <div role="toolbar" className={styles.toolbar}>
                <div>
                    <IconButton
                        icon={IoShareSocial}
                        label="Share"
                        onClick={() => setShare(true) }
                    />

                    { share && <Share source={program.source} onClose={() => setShare(false)} /> }
                </div>
            </div>

            <div className={styles.code}>
                <Highlights
                    ref={highlightsRef}
                    program={program}
                    compilerError={compilerError}
                />

                <textarea
                    ref={textAreaRef}
                    value={program.source}
                    autoFocus={autoFocus}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    onSelect={onSelect}
                    onKeyDown={keyMapHandler}
                    onChange={e => setSource(e.target.value)}
                />
            </div>
        </div>
    );
}

function getCaretPosition(source: string, position: number) {
    let line = 1;
    let bol = 0;

    for (;;) {
        const eol = source.indexOf("\n", bol);
        if (eol === -1 || eol >= position)
            break;

        bol = eol + 1;
        line++;
    }

    return { line, column: position - bol + 1 };
}

function findHighlightedSpan(highlights: HTMLElement, line: number, column: number) {
    let lastSpan;
    for (const span of highlights.querySelectorAll<HTMLElement>(`[data-line="${line}"]`)) {
        const spanColumn = span.dataset.column;
        if (spanColumn && parseFloat(spanColumn) > column)
            break;

        lastSpan = span;
    }

    return lastSpan;
}
