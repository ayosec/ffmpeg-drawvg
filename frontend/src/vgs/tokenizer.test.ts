import { expect, test } from "vitest";

import tokenize from "./tokenizer";

test("basic", () => {
    const tokens = tokenize("M 0 (x\n+ 3)\n//. .\n\nsetvar\n  x\n1");

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 1, offset: 0, kind: "keyword", lexeme: "M" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 2, offset: 1, kind: "whitespace", lexeme: " " },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: {
            line: 1,
            column: 3,
            offset: 2,
            kind: "number",
            lexeme: "0",
            param: { inst: "M", pos: 0 },
        }
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 4, offset: 3, kind: "whitespace", lexeme: " " },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: {
            line: 1,
            column: 5,
            offset: 4,
            kind: "expr",
            lexeme: "(x\n+ 3)",
            param: { inst: "M", pos: 1 },
        },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 2, column: 5, offset: 11, kind: "whitespace", lexeme: "\n" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 3, column: 1, offset: 12, kind: "comment", lexeme: "//. ." },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 3, column: 6, offset: 17, kind: "whitespace", lexeme: "\n\n" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 5, column: 1, offset: 19, kind: "keyword", lexeme: "setvar" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 5, column: 7, offset: 25, kind: "whitespace", lexeme: "\n  " },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: {
            line: 6,
            column: 3,
            offset: 28,
            kind: "word",
            lexeme: "x",
            param: { inst: "setvar", pos: 0 },
        },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 6, column: 4, offset: 29, kind: "whitespace", lexeme: "\n" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: {
            line: 7,
            column: 1,
            offset: 30,
            kind: "number",
            lexeme: "1",
            param: { inst: "setvar", pos: 1 },
        },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 7, column: 2, offset: 31, kind: "whitespace", lexeme: "\n" },
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
        value: {
            line: 1,
            column: 3,
            offset: 2,
            kind: "expr",
            lexeme: "((a + b)",
            param: { inst: "l", pos: 0 },
        },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 11, offset: 10, kind: "whitespace", lexeme: "\n" },
    });

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: {
            line: 2,
            column: 1,
            offset: 11,
            kind: "number",
            lexeme: "1",
            param: { inst: "l", pos: 1 },
        },
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
