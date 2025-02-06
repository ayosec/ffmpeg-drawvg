import CompilerError from "../vgs/CompilerError";
import tokenize from "../vgs/tokenizer";
import { Colors } from "@backend/syntax";
import { Program } from "../render/protocol";

import styles from "./editor.module.css";

interface Props {
    ref?: React.RefObject<HTMLPreElement|null>;
    program: Program;
    compilerError: CompilerError|null;
}

interface KnownColor {
    fg: string;
    bg: string;
}

function hashString(key: number, ...strs: string[]) {
    // Adapted from https://github.com/darkskyapp/string-hash

    let hash = 5381;

    for (const str of strs)
        for (let i = str.length - 1; i >= 0; i--)
            hash = (hash * 33) ^ str.charCodeAt(i);

    return `${key}-${hash}`;
}

function luminance(color: readonly [number, number, number]): number {
    // https://github.com/sharkdp/pastel/blob/v0.10.0/src/lib.rs#L654-L669

    const f = (s: number) => {
        if (s <= 0.03928) {
            return s / 12.92;
        } else {
            return Math.pow((s + 0.055) / 1.055, 2.4);
        }
    };

    const r = f(color[0] / 255);
    const g = f(color[1] / 255);
    const b = f(color[2] / 255);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getColor(colorExpr: string): KnownColor | undefined {
    const LUMINANCE_THRESHOLD = 0.179;

    const alphaPart = colorExpr.indexOf("@");
    if (alphaPart > 0)
        colorExpr = colorExpr.substring(0, alphaPart);

    let color;
    if (colorExpr.startsWith("#") && colorExpr.length === 7) {
        color = [
            parseInt(colorExpr.substring(1, 3), 16),
            parseInt(colorExpr.substring(3, 5), 16),
            parseInt(colorExpr.substring(5, 7), 16),
        ] as const;
    } else {
        color = Colors[colorExpr.toLowerCase()];
    }

    if (color === undefined)
        return undefined;

    return {
        fg: luminance(color) > LUMINANCE_THRESHOLD ? "#000" : "#FFF",
        bg: `rgb(${color.join(",")})`,
    };
}

export default function Highlights({ ref, program, compilerError }: Props) {
    const spans = [];
    let index = 0;

    let needNewLine = true;
    let lineNumber = 0;

    for (const token of tokenize(program.source)) {
        const style: React.CSSProperties = {};

        if (token.kind == "word" || token.kind == "color") {
            const knownColor = getColor(token.lexeme);
            if (knownColor) {
                style.color = knownColor.fg;
                style.backgroundColor = knownColor.bg;
            }
        }

        let lexeme = token.lexeme;
        let kind = token.kind;

        if (compilerError
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

                spans.push(
                    <span
                        key={`${key}-nl`}
                        className={styles.lineNumber}
                    >
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
                        data-line={token.line}
                        data-column={token.column}
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
