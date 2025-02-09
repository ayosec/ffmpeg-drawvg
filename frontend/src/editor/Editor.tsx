import { useRef, useState } from "react";

import { IoShareSocial } from "react-icons/io5";

import * as CompImpl from "./completion.impl";
import CompilerError from "../vgs/CompilerError";
import Completion from "./Completion";
import Highlights from "./Highlights";
import IconButton from "../IconButton";
import Share from "./Share";
import keyMapHandler from "./keymap";
import { Program } from "../render/protocol";
import { getParameters } from "../vgs/decls";

import styles from "./editor.module.css";

interface Props {
    autoFocus?: boolean,
    program: Program,
    compilerError: CompilerError|null;
    setSource(source: string): void;
}

interface HoverInfo {
    clientX: number;
    clientY: number;
    inst: string;
    params: readonly string[]|undefined;
    paramsPosition: number;
}

export default function Editor({ autoFocus, program, compilerError, setSource }: Props) {
    const highlightsRef = useRef<HTMLPreElement>(null);

    const lastHighlightedSpan = useRef<HTMLElement>(null);

    const [ share, setShare ] = useState(false);

    const [ completion, setCompletion ] = useState<CompImpl.Props|null>();

    const debounceHover = useRef<ReturnType<typeof setTimeout>>(null);

    const [ hoverInfo, setHoverInfo ] = useState<HoverInfo|null>(null);

    const onSelect = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textArea = event.currentTarget;
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
        if (highlightedSpan
            && lastHighlightedSpan.current !== highlightedSpan
        ) {
            lastHighlightedSpan.current = highlightedSpan;
            textArea.style.caretColor = getComputedStyle(highlightedSpan).color;
        }

        // Hide autocompletion when caret is moved.
        if (completion
            && completion.currentWord.caret !== textArea.selectionStart
        ) {
            setCompletion(null);
        }

        if (hoverInfo)
            setHoverInfo(null);
    };

    const onMouseMove = (event: React.MouseEvent) => {
        if (debounceHover.current !== null)
            clearTimeout(debounceHover.current);

        debounceHover.current = setTimeout(() => {
            debounceHover.current = null;

            if (highlightsRef.current === null)
                return;

            const hover = findHoverInfo(highlightsRef.current, event.clientX, event.clientY);
            setHoverInfo(hover);
        }, 250);
    };

    return (
        <div className={styles.editor} data-panel="editor">
            <div role="toolbar" className={styles.toolbar}>
                <div>
                    <IconButton
                        Icon={IoShareSocial}
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
                    compilerError={completion ? null : compilerError}
                />

                <textarea
                    value={program.source}
                    autoFocus={autoFocus}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    onSelect={onSelect}
                    onMouseMove={onMouseMove}
                    onBlur={() => setCompletion(null)}
                    onMouseLeave={() => setHoverInfo(null)}
                    onKeyDown={e => {
                        if (completion) {
                            const [ captured, nextState ] = CompImpl.onKeyDown(e, completion);
                            if (captured) {
                                setCompletion(nextState);
                                e.preventDefault();
                                return;
                            }
                        }

                        keyMapHandler(e);
                    }}
                    onChange={e => {
                        setSource(e.currentTarget.value);
                        setCompletion(CompImpl.configure(e.currentTarget));
                    }}
                />

                { completion && <Completion {...completion} /> }

                { !completion && hoverInfo && <HoverInfo {...hoverInfo} /> }
            </div>
        </div>
    );
}

function HoverInfo({ clientX, clientY, inst, params, paramsPosition }: HoverInfo) {
    return (
        <div
            style={{ top: clientY + "px", left: clientX + "px" }}
            className={styles.hoverInfo}
        >
            <span
                className={styles.inst + " " + (paramsPosition === -1 ? styles.hoverParam : "")}
            >{inst}</span>
            {
                params?.map((p, i) =>
                    <span
                        key={i}
                        className={i === paramsPosition ? styles.hoverParam : undefined}
                    >
                        {" "}{p}
                    </span>
                )
            }
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

function findHoverInfo(highlights: HTMLElement, clientX: number, clientY: number): HoverInfo|null {
    const spans = highlights.querySelectorAll<HTMLElement>("span[data-kind]");

    let start = 0;
    let end = spans.length - 1;

    let target: HTMLElement|undefined;

    while (start <= end) {
        const middle = Math.floor((start + end) / 2);

        const span = spans[middle];
        const rect = span.getBoundingClientRect();

        let relative = 0;

        if (rect.top > clientY)
            relative = -1;
        else if (rect.top + rect.height < clientY)
            relative = 1;
        else if (rect.left > clientX)
            relative = -1;
        else if (rect.left + rect.width < clientX)
            relative = 1;
        else {
            target = span;
            break;
        }

        if (relative < 0)
            end = middle - 1;
        else
            start = middle + 1;
    }

    if (target === undefined)
        return null;

    let inst = target.dataset.paramInst;
    let paramsPosition = parseFloat(target.dataset.paramPos ?? "0");

    if (inst === undefined && target.dataset.kind === "keyword") {
        inst = target.innerText;
        paramsPosition = -1;
    }

    const params = getParameters(inst ?? "");

    if (inst === undefined || params === undefined)
        return null;

    return { clientX, clientY, inst, params, paramsPosition };
}
