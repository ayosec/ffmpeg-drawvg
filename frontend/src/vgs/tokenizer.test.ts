import { expect, test } from "vitest";

import tokenize from "./tokenizer";

test("basic", () => {
    const tokens = tokenize("move 0 (x\n+ 3)\n//. .\n\nsetvar\n  x\n1");

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 1, offset: 0, kind: "word", lexeme: "move" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 5, offset: 4, kind: "whitespace", lexeme: " " },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 6, offset: 5, kind: "number", lexeme: "0" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 7, offset: 6, kind: "whitespace", lexeme: " " },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 8, offset: 7, kind: "expr", lexeme: "(x\n+ 3)" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 2, column: 5, offset: 14, kind: "whitespace", lexeme: "\n" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 3, column: 1, offset: 15, kind: "comment", lexeme: "//. ." },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 3, column: 6, offset: 20, kind: "whitespace", lexeme: "\n\n" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 5, column: 1, offset: 22, kind: "keyword", lexeme: "setvar" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 5, column: 7, offset: 28, kind: "whitespace", lexeme: "\n  " },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 6, column: 3, offset: 31, kind: "word", lexeme: "x" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 6, column: 4, offset: 32, kind: "whitespace", lexeme: "\n" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 7, column: 1, offset: 33, kind: "number", lexeme: "1" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 7, column: 2, offset: 34, kind: "whitespace", lexeme: "\n" },
    });

    expect(tokens.next().done).toBe(true);
});

test("unmatched parenthesis", () => {
    const tokens = tokenize("l ((a + b)\n1 (x");

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 1, offset: 0, kind: "keyword", lexeme: "l" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 2, offset: 1, kind: "whitespace", lexeme: " " },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 3, offset: 2, kind: "expr", lexeme: "((a + b)" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 11, offset: 10, kind: "whitespace", lexeme: "\n" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 2, column: 1, offset: 11, kind: "number", lexeme: "1" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 2, column: 2, offset: 12, kind: "whitespace", lexeme: " " },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 2, column: 3, offset: 13, kind: "expr", lexeme: "(x" },
    });
});
