import tokenize from "../vgs/tokenizer";
import useCurrentProgram from "../currentProgram";
import { parseColor } from "../utils/colors";

import styles from "./editor.module.css";

interface Props {
    ref?: React.RefObject<HTMLPreElement|null>;
    showErrors: boolean;
}

function hashString(key: number, ...strs: string[]) {
    // Adapted from https://github.com/darkskyapp/string-hash

    let hash = 5381;

    for (const str of strs)
        for (let i = str.length - 1; i >= 0; i--)
            hash = (hash * 33) ^ str.charCodeAt(i);

    return `${key}-${hash}`;
}

export default function Highlights({ ref, showErrors }: Props) {
    const source = useCurrentProgram(s => s.source);
    const compilerError = useCurrentProgram(s => s.compilerError);

    const spans = [];
    let index = 0;

    let needNewLine = true;
    let lineNumber = 0;

    for (const token of tokenize(source)) {
        const style: React.CSSProperties = {};

        if (token.kind == "word" || token.kind == "color") {
            const knownColor = parseColor(token.lexeme);
            if (knownColor) {
                style.color = knownColor.fg;
                style.backgroundColor = knownColor.bg;
            }
        }

        let lexeme = token.lexeme;
        let kind: string = token.kind;

        if (showErrors
            && compilerError
            && compilerError.line === token.line
            && compilerError.column === token.column
        ) {
            kind = "_invalid";

            spans.push(
                <span
                    key={"errmsg-" + hashString(lineNumber, compilerError.message)}
                    role="alert"
                    className={styles.errorMessage}
                >
                    {compilerError.message}
                </span>
            );
        }

        while (lexeme !== "") {
            const key = hashString(++index, kind, token.lexeme);

            if (needNewLine) {
                needNewLine = false;
                lineNumber++;

                let className = styles.lineNumber;

                if (compilerError?.line === lineNumber)
                    className += " " + styles.hasError;

                spans.push(
                    <span key={`${key}-nl`} className={className}>
                        {lineNumber}
                    </span>
                );
            }

            const nl = lexeme.indexOf("\n");
            let current;
            if (nl === -1) {
                current = lexeme;
                lexeme = "";
            } else {
                current = lexeme.substring(0, nl);
                lexeme = lexeme.substring(nl + 1);
            }

            if (current !== "") {
                spans.push(
                    <span
                        key={key}
                        style={style}
                        data-kind={kind}
                        data-offset={token.offset}
                        data-line={token.line}
                        data-column={token.column}
                        data-param-inst={token.param?.inst}
                        data-param-pos={token.param?.pos}
                    >
                        {current}
                    </span>
                );
            }

            if (nl !== -1) {
                spans.push("\n");
                needNewLine = true;
            }
        }
    }

    return <pre ref={ref} aria-hidden={true}>{spans}</pre>;
}
