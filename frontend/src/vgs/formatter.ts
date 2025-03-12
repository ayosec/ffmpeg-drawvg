import tokenize from "./tokenizer";

export default function format(code: string, caret: number) {
    const output: string[] = [];
    let updatedCaret: number|undefined = undefined;

    let indentLevel = 0;

    let isBOL = true;
    let isSourceBOL = true;
    let hasBlankLine = false;

    const emit = (token: string) => {
        if (isBOL && /\S/.test(token))
            output.push("\t".repeat(indentLevel));

        output.push(token);

        isBOL = token.endsWith("\n");
        hasBlankLine = false;
        isSourceBOL = false;
    };

    for (const token of tokenize(code)) {
        switch (token.kind) {
            case "whitespace": {
                let lexeme = token.lexeme;

                if (lexeme.indexOf(",") !== -1) {
                    emit(",");
                    lexeme = lexeme.replace(/.*\S/, "");
                }

                if (!hasBlankLine && /\n.*\n/.test(lexeme))
                    hasBlankLine = true;

                if (!isSourceBOL && lexeme.indexOf("\n") !== -1)
                    isSourceBOL = true;
                break;
            }

            case "keyword":
                if(hasBlankLine)
                    emit("\n\n");
                else if(!isBOL)
                    emit("\n");

                emit(token.lexeme);
                break;

            case "comment":
                if (hasBlankLine)
                    emit("\n\n");
                else if (output.length === 0)
                    { /* es-lint: no-empty: "allow" */ } // emit nothing.
                else if (isSourceBOL)
                    emit("\n");
                else if (!isBOL)
                    emit(" ");

                emit(token.lexeme.trimEnd());
                break;

            default:
                switch (token.lexeme) {
                    case "}":
                        if (!isBOL)
                            emit("\n");

                        indentLevel = Math.max(indentLevel - 1, 0);
                        emit("}");
                        break;

                    case "{":
                        emit(" {");
                        indentLevel++;
                        break;

                    default:
                        emit(isSourceBOL
                            ? "\n" + "\t".repeat(indentLevel + 1)
                            : " ");

                        emit(token.lexeme);
                }
        }

        if (updatedCaret === undefined
            && token.offset + token.lexeme.length > caret
        ) {
            const len = output.reduce((a, b) => a + b.length, 0);
            updatedCaret =
                token.kind === "whitespace"
                    ? len
                    : len + caret - token.offset - token.lexeme.length;
        }
    }

    return {
        code: output.join(""),
        caret: updatedCaret ?? caret,
    };
}
