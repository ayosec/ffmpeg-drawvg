import { Instructions } from "@backend/syntax";
import { getParameters } from "./decls";

type Kind
    = "whitespace"
    | "color"
    | "comment"
    | "expr"
    | "keyword"
    | "number"
    | "unknown"
    | "word"
    ;

interface Parameter {
    inst: string;
    pos: number;
};

interface Token {
    kind: Kind
    line: number;
    column: number;
    offset: number;
    lexeme: string;
    param?: Parameter;
}

interface Rule {
    pattern: RegExp;
    kind: Kind;
}

export default function* tokenize(code: string): Generator<Token, undefined, undefined> {

    const RULES: Rule[] = [
        { pattern: /(,|\s)+/g, kind: "whitespace" },
        { pattern: /[+-]?[0-9][^\s,]*/g, kind: "number" },
        { pattern: /\w+@[0-9]*(\.[0-9]*)?/g, kind: "color" },
        { pattern: /#[a-fA-F0-9]+(@\d*\.?\d*)?/g, kind: "color" },
        { pattern: /\w\S*/g, kind: "word" },
        { pattern: /\/\/.*/g, kind: "comment" }
    ];

    let line = 1;
    let column = 1;

    let currentInst: undefined|string;
    let currentParams: undefined|readonly string[];
    let currentParamsOffset = 0;

    let cursor = 0;
    const codeLen = code.length;
    while (cursor < codeLen) {
        const token: Token = {
            kind: "unknown",
            line,
            column,
            offset: cursor,
            lexeme: "",
        };

        if (code[cursor] === "(") {
            let level = 1;
            const parenthesis = /[()]/g;

            parenthesis.lastIndex = cursor + 1;
            while (level > 0) {
                const m = parenthesis.exec(code);
                if (m === null) {
                    // Unmatched parenthesis. Assume it is only one line.
                    const eol = code.indexOf("\n", cursor);
                    parenthesis.lastIndex = eol === -1 ? codeLen : eol;
                    level = 0;
                } else if (m[0] === "(") {
                    level++;
                } else if (m[0] === ")") {
                    level--;
                } else {
                    throw "Unreachable";
                }
            }

            token.kind = "expr";
            token.lexeme = code.substring(cursor, parenthesis.lastIndex);
        } else {
            for (const rule of RULES) {
                rule.pattern.lastIndex = cursor;
                const m = rule.pattern.exec(code);
                if (m === null || m.index !== cursor)
                    continue;

                token.kind = rule.kind;
                token.lexeme = m[0];
                break;
            }
        }

        if (!token.lexeme) {
            token.kind = "unknown";
            token.lexeme = code[cursor];
        }

        if (
            currentInst === undefined
                && token.kind === "word"
                && Instructions.has(token.lexeme)
        ) {
            token.kind = "keyword";
        }

        // Add parameter info.
        if (currentInst !== undefined) {
            switch (token.kind) {
                case "color":
                case "expr":
                case "number":
                case "word":
                    token.param = {
                        inst: currentInst,
                        pos: currentParamsOffset,
                    };

                    currentParamsOffset++;
                    if (currentParamsOffset >= (currentParams?.length ?? 0)) {
                        currentInst = undefined;
                        currentParams = undefined;
                    }
            }
        } else if (token.kind === "keyword") {
            currentParamsOffset = 0;
            currentParams = getParameters(token.lexeme);
            if (currentParams && currentParams.length > 0) {
                currentInst = token.lexeme;
            } else {
                currentInst = undefined;
                currentParams = undefined;
            }
        }


        cursor += token.lexeme.length;
        yield token;

        // Update span.
        let offset = 0;
        for (;;) {
            const i = token.lexeme.indexOf("\n", offset);
            if (i === -1)
                break;

            offset = i + 1;

            line++;
            column = 1;
        }

        column += token.lexeme.length - offset;
    }

    yield { line, column, offset: cursor, kind: "whitespace", lexeme: "\n" };
}
