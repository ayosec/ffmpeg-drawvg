import { expect, test } from "vitest";

import format from "./formatter";

test("basic", () => {
    const { code, caret } = format(
        [
            "rect 0 0 w h setcolor",
            "  blue if (x) {",
            "setvar\tx    1 repeat 3 {   // abc xyz ",
            "setvar\ny 2\t}\t\n\n\nsetcolor red // 0 1 2",
            "} fill",
            "\t",
            "\t// 3 4 5 6",
            "setcolor black circle 10 20 30 stroke",
            "// abcdef",
            "",
        ].join("\n"),
        133
    );

    expect(code).toBe(
        [
            "rect 0 0 w h",
            "setcolor",
            "\tblue",
            "if (x) {",
            "\tsetvar x 1",
            "\trepeat 3 { // abc xyz",
            "\t\tsetvar",
            "\t\t\ty 2",
            "\t}",
            "",
            "\tsetcolor red // 0 1 2",
            "}",
            "fill",
            "",
            "// 3 4 5 6",
            "setcolor black",
            "circle 10 20 30",
            "stroke",
            "// abcdef",
        ].join("\n")
    );

    expect(caret).toBe(131);
});

test("multiline sentences", () => {
    const { code, caret } = format("setvar\n\n\nx\n1", 9);
    expect(code).toBe("setvar\n\tx\n\t1");
    expect(caret).toBe(8);
});

test("caret on whitespaces", () => {
    const { code, caret } = format("setvar   x   1", 8);
    expect(code).toBe("setvar x 1");
    expect(caret).toBe(6);
});
