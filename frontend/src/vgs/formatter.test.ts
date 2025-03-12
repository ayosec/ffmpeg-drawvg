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
            "setcolor black circle 10 0x10p5 0xAA stroke",
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
            "circle 10 0x10p5 0xAA",
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

test("comments at first line", () => {
    const { code, caret } = format("// first line \n\n// second line \n", 1);
    expect(code).toBe("// first line\n\n// second line");
    expect(caret).toBe(0);
});

test("keep commas", () => {
    const { code, caret } = format("l 0,1 2 3,,,4,\n\n,\n5\n,\n6,", 1);
    expect(code).toBe("l 0, 1 2 3, 4,\n\t5,\n\t6,");
    expect(caret).toBe(1);
});
