import { expect, test } from "vitest";

import tokenize from "./tokenizer";

test("basic", () => {
    const tokens = tokenize("move 0 (x\n+ 3)\n//. .\n\nsetvar\n  x\n1");

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 1, kind: "word", lexeme: "move" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 5, kind: "whitespace", lexeme: " " },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 6, kind: "number", lexeme: "0" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 7, kind: "whitespace", lexeme: " " },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 8, kind: "expr", lexeme: "(x\n+ 3)" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 2, column: 5, kind: "whitespace", lexeme: "\n" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 3, column: 1, kind: "comment", lexeme: "//. ." },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 3, column: 6, kind: "whitespace", lexeme: "\n\n" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 5, column: 1, kind: "keyword", lexeme: "setvar" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 5, column: 7, kind: "whitespace", lexeme: "\n  " },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 6, column: 3, kind: "word", lexeme: "x" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 6, column: 4, kind: "whitespace", lexeme: "\n" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 7, column: 1, kind: "number", lexeme: "1" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 7, column: 2, kind: "whitespace", lexeme: "\n" },
    })

    expect(tokens.next().done).toBe(true);
});

test("unmatched parenthesis", () => {
    const tokens = tokenize("l ((a + b)\n1 (x");

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 1, kind: "keyword", lexeme: "l" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 2, kind: "whitespace", lexeme: " " },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 3, kind: "expr", lexeme: "((a + b)" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 1, column: 11, kind: "whitespace", lexeme: "\n" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 2, column: 1, kind: "number", lexeme: "1" },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 2, column: 2, kind: "whitespace", lexeme: " " },
    })

    expect(tokens.next()).toStrictEqual({
        done: false,
        value: { line: 2, column: 3, kind: "expr", lexeme: "(x" },
    })

});
