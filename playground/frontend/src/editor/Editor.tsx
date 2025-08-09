import { useRef, useState } from "react";

import { BsTextIndentLeft } from "react-icons/bs";
import { FaKeyboard } from "react-icons/fa";
import { FaRegFolderOpen } from "react-icons/fa6";
import { IoLibrary, IoShareSocial } from "react-icons/io5";
import { MdOutlineHelp } from "react-icons/md";

import * as CompImpl from "./completion.impl";
import Completion from "./Completion";
import ExampleGallery from "../gallery/ExampleGallery";
import Files from "./Files";
import Help from "../base/Help";
import Highlights from "./Highlights";
import IconButton from "../base/IconButton";
import KeyboardShortcuts from "../base/KeyboardShortcuts";
import Share from "./Share";
import format from "../vgs/formatter";
import keyMapHandler from "./keymap";
import useExamplesGallery from "../gallery/state";
import { getParameters } from "../vgs/decls";

import styles from "./editor.module.css";
import useCurrentProgram from "../currentProgram";

interface Props {
    autoFocus?: boolean,
}

interface HoverInfo {
    clientX: number;
    clientY: number;
    inst: string;
    params: readonly string[]|undefined;
    paramsPosition: number;
}

export default function Editor({ autoFocus }: Props) {
    const source = useCurrentProgram(s => s.source);
    const activeFileName = useCurrentProgram(s => s.activeFileName);
    const compilerError = useCurrentProgram(s => s.compilerError);
    const setSource = useCurrentProgram(s => s.setSource);

    const highlightsRef = useRef<HTMLPreElement>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const lastHighlightedSpan = useRef<HTMLElement>(null);

    const [ share, setShare ] = useState(false);

    const [ showFiles, setShowFiles ] = useState(false);

    const [ keyboardShortcuts, setKeyboardShortcuts ] = useState(false);

    const exampleGallery = useExamplesGallery(s => s.isOpen);

    const setExampleGallery = useExamplesGallery(s => s.setOpen);

    const [ help, setHelp ] = useState(false);

    const [ completion, setCompletion ] = useState<CompImpl.Props|null>();

    const debounceHover = useRef<ReturnType<typeof setTimeout>>(null);

    const [ hoverInfo, setHoverInfo ] = useState<HoverInfo|null>(null);

    const onSelect = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const textArea = event.currentTarget;
        const highlights = highlightsRef.current;

        if (textArea === null || highlights === null)
            return;

        const caret = getCaretPosition(source, textArea.selectionStart);

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
                        Icon={FaRegFolderOpen}
                        label="Files"
                        shortcut="ctrl-s"
                        onClick={() => setShowFiles(true)}
                    />

                    <IconButton
                        Icon={IoShareSocial}
                        label="Share"
                        onClick={() => setShare(!share)}
                    />

                    <IconButton
                        Icon={BsTextIndentLeft}
                        label="Reformat Code"
                        shortcut="ctrl-i"
                        onClick={() => {
                            if (textareaRef.current)
                                reformatCode(textareaRef.current);
                        }}
                    />

                    { share &&
                        <Share
                            name={activeFileName ?? "drawvg"}
                            source={source}
                            onClose={() => setShare(false)}
                        />
                    }

                    { showFiles &&
                        <Files
                            onClose={() => {
                                setShowFiles(false);

                                requestAnimationFrame(() => {
                                    textareaRef.current?.focus();
                                });
                            }}
                        />
                    }

                    { keyboardShortcuts &&
                        <KeyboardShortcuts onClose={() => setKeyboardShortcuts(false)} />
                    }

                    { exampleGallery &&
                        <ExampleGallery onClose={() => setExampleGallery(false)} />
                    }

                    { help &&
                        <Help onClose={() => setHelp(false)} />
                    }
                </div>

                {
                    activeFileName && (
                        <div>
                            <span
                                aria-label={`Current File: ${activeFileName}`}
                                className={styles.fileName}
                            >
                                <span>{activeFileName}</span>
                            </span>
                        </div>
                    )
                }

                <div>
                    <IconButton
                        Icon={IoLibrary}
                        label="Examples Gallery"
                        onClick={() => setExampleGallery(!exampleGallery)}
                    />

                    <IconButton
                        Icon={FaKeyboard}
                        label="Keyboard Shortcuts"
                        shortcut="ctrl-k"
                        onClick={() => setKeyboardShortcuts(!keyboardShortcuts)}
                    />

                    <IconButton
                        Icon={MdOutlineHelp}
                        label="Help"
                        shortcut="ctrl-h"
                        onClick={() => setHelp(!help)}
                    />
                </div>
            </div>

            <div className={styles.code}>
                <Highlights
                    ref={highlightsRef}
                    showErrors={!completion}
                />

                <textarea
                    ref={textareaRef}
                    value={source}
                    autoFocus={autoFocus}
                    spellCheck={false}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    onSelect={onSelect}
                    onMouseMove={onMouseMove}
                    onBlur={() => setCompletion(null)}
                    onMouseLeave={() =>{
                        if (debounceHover.current !== null)
                            clearTimeout(debounceHover.current);

                        setHoverInfo(null);
                    }}
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

function reformatCode(textarea: HTMLTextAreaElement) {
    const { code, caret } = format(textarea.value, textarea.selectionStart);

    // Use execCommand to set the value, so users can use the native undo action
    // to restore the code before reformat.

    textarea.focus();
    textarea.select();

    (document as any).execCommand("insertText", false, code);
    textarea.setSelectionRange(caret, caret);
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
