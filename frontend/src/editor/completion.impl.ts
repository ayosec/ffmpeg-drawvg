import tokenize from "../vgs/tokenizer";
import { Colors, Instructions } from "@backend/syntax";
import { getParameters } from "../vgs/decls";

interface CurrentWord {
    caret: number;
    word: string;
    start: number;
    tokenKind: string;
}

interface Suggestion {
    text: string;
    color?: string;
    params?: readonly string[];
}

export interface Props {
    selected: number;
    textarea: HTMLTextAreaElement;
    currentWord: CurrentWord;
    suggestions: Suggestion[]
}


export function configure(textarea: HTMLTextAreaElement): Props|null {
    const cw = getCurrentWord(textarea);

    switch (cw?.tokenKind) {
        case "word":
        case "keyword":
            return tryInstructions(textarea, cw);

        case "color":
            return tryColors(textarea, cw);

        default:
            return null;
    }
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

function getCurrentWord(textarea: HTMLTextAreaElement): CurrentWord|null {
    const source = textarea.value;
    const caret = textarea.selectionStart;

    for (const token of tokenize(source)) {
        if (token.offset < caret
            && token.offset + token.lexeme.length >= caret
        ) {
            let tokenKind = token.kind;

            if (token.param) {
                const params = getParameters(token.param.inst);
                if (params && params[token.param.pos] === "color")
                    tokenKind = "color";
            }

            return {
                caret,
                word: token.lexeme,
                start: token.offset,
                tokenKind,
            };
        }
    }

    return null;
}

function tryInstructions(textarea: HTMLTextAreaElement, cw: CurrentWord): Props|null {
    const suggestions = [];
    for (const i of Instructions) {
        if (i.startsWith(cw.word)) {
            const params = getParameters(i);
            suggestions.push({ text: i, params });
        }
    }

    if (suggestions.length === 0
        || (suggestions.length === 1 && suggestions[0].text === cw.word)
    ) {
        return null;
    }

    suggestions.sort();

    return {
        textarea,
        suggestions,
        selected: 0,
        currentWord: cw,
    };
}

function tryColors(textarea: HTMLTextAreaElement, cw: CurrentWord): Props|null {
    const suggestions = [];
    for (const [name, color] of Object.entries(Colors)) {
        if (name.indexOf(cw.word) !== -1) {
            suggestions.push({
                text: name,
                color: `rgb(${color.join(",")})`,
            });
        }
    }

    if (suggestions.length === 0
        || (suggestions.length === 1 && suggestions[0].text === cw.word)
    ) {
        return null;
    }

    suggestions.sort();

    return {
        textarea,
        suggestions,
        selected: 0,
        currentWord: cw,
    };
}

export function insertSuggestion(props: Props) {
    requestAnimationFrame(() => {
        const { textarea, currentWord } = props;

        const insert = props.suggestions[props.selected].text + " ";

        textarea.focus();
        textarea.setSelectionRange(
            currentWord.start,
            currentWord.start + currentWord.word.length,
        );

        (document as any).execCommand("insertText", false, insert);
    });
}
