import fs from "node:fs";
import path from "node:path";
import { hash } from "node:crypto";
import { tmpdir } from "node:os";

import bash from "highlight.js/lib/languages/bash";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import shell from "highlight.js/lib/languages/shell";
import { HLJSApi } from "highlight.js";

import Scanner from "./scanner";
import tokenize from "@frontend/vgs/tokenizer";
import { Instructions } from "@backend/syntax";
import { commandLinkFor } from "./markup";
import { parseColor } from "@frontend/utils/colors";

hljs.registerLanguage("bash", (api) => {
    const base = bash(api);
    (<any>base).keywords.built_in.push("ffmpeg", "ffplay", "ffprobe", "grep", "gzip", "perl");
    return base;
});

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("console", shell);
hljs.registerLanguage("filter", filtergraphLang);

interface MarkSpan {
    kind: string;
    line: number;
    column: number;
    length: number;
}

// Resolve `@highlight/` paths to files downloaded for the
// highlight.js library. Files are stored in a cache directory.
export async function highlightThemeCSS(id: string): Promise<string> {
    const THEME_URI_PREFIX = "@highlight/";

    if (!id.startsWith(THEME_URI_PREFIX))
        return id;

    const suffix = id.substring(THEME_URI_PREFIX.length);
    const outputDir = path.join(tmpdir(), "drawvg-vendor-files");

    const url = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/" + suffix;
    const urlHash = hash("sha256", url, "base64url").substring(0, 16);

    const fileName = path.join(outputDir, `highlight-${urlHash}.css`);

    if (fs.existsSync(fileName))
        return fileName;

    console.log("THEME: Download %s to %s", url, fileName);

    if (!fs.existsSync(outputDir))
        fs.mkdirSync(outputDir);

    const response = await fetch(url);
    if (!response.ok || !response.body) {
        console.error("Invalid response:", response);
        throw "Invalid response for " + url;
    }

    const data = await response.arrayBuffer();
    fs.writeFileSync(fileName, new DataView(data));

    return fileName;
}

export default function highlight(
    language: string,
    code: string,
    useColorWords: boolean,
    langRefName: string,
    marks: MarkSpan[]
) {
    switch (language) {
        case "vgs":
            return hlVGS(code, useColorWords, langRefName, marks);

        case "signature":
            return signature(code);

        default:
            return hljs.highlight(code, { language }).value;
    }
}

const CSS_CLASSES: { [k: string]: string } = {
    "comment": "comment",
    "expr": "string",
    "keyword": "title function_",
    "number": "number",
    "subprogram": "type",
};

function hlVGS(code: string, useColorWords: boolean, langRefName: string, marks: MarkSpan[]) {
    const spans = [];

    for (const token of tokenize(code)) {
        const cls = CSS_CLASSES[token.kind];

        let lexemeText = token.lexeme;

        if (marks.length > 0) {
            const mark = marks.find(e =>
                e.line === token.line
                && e.column >= token.column
                && (e.column + e.length <= (token.lexeme.length + token.column))
            );

            if (mark !== undefined) {
                const start = mark.column - token.column;
                const end = start + mark.length;

                // Add \x01 and \x02 marks to add error highlight later.
                lexemeText = [
                    lexemeText.substring(0, start),
                    "\x01",
                    mark.kind,
                    "\x01",
                    lexemeText.substring(start, end),
                    "\x02",
                    lexemeText.substring(end),
                ].join("");
            }
        }

        let htmlLexeme = htmlEscape(lexemeText);

        if (token.kind === "keyword" && Instructions.has(token.lexeme))
            htmlLexeme = `<a href="${langRefName}#${commandLinkFor(token.lexeme)}">${htmlLexeme}</a>`;

        if (cls) {
            spans.push(`<span class="hljs-${cls}">${htmlLexeme}</span>`);
        } else {
            let color = undefined;
            if (useColorWords && (token.kind === "color" || token.kind === "word"))
                color = previewColor(token.lexeme);

            spans.push(color || htmlLexeme);
        }
    }

    return spans.join("");
}

function previewColor(lexeme: string) {
    const color = parseColor(lexeme);
    if (color === undefined)
        return null;

    const style = `color: ${color.fg}; background: ${color.bg};`;
    return `<span class="preview-color" style="${style}">${lexeme}</span>`;
}

const CAN_BE_IMPLICIT = [
    "   &mdash; ",
    `<a class="command-implicit" href="#implicit-commands">`,
    "Can be implicit",
    "</a>",
].join("");

function signature(code: string) {
    const scanner = new Scanner(code);
    const spans = [``];

    const takeWS = () => spans.push(scanner.whitespace());

    takeWS();

    // Commands
    for (; ;) {
        const c = scanner.scan(/\w+/);
        if (!c)
            break;

        spans.push(`<span class="signature-command hljs-${CSS_CLASSES.keyword}">${c}</span>`);

        const sep = scanner.scan(/\s*,\s*/);
        if (!sep)
            break;

        spans.push(sep);
    }

    // Arguments
    for (; ;) {
        takeWS();

        const c = scanner.scan(/\w+\*?/);
        if (!c)
            break;

        spans.push(`<span class="signature-argument hljs-${CSS_CLASSES.number}">${c}</span>`);
    }

    // Subprogram
    takeWS();
    const sp = scanner.scan(/\{.*\}/);
    if (sp)
        spans.push(`<span class="hljs-${CSS_CLASSES.subprogram}">${htmlEscape(sp)}</span>`);

    if (scanner.scan(/\s*\*\*/)) {
        spans.push(CAN_BE_IMPLICIT);
    }

    spans.push(htmlEscape(scanner.tail()));

    return spans.join("");
}

function htmlEscape(text: string) {
    return text
        .replaceAll(/&/g, "&amp;")
        .replaceAll(/</g, "&lt;")
        .replaceAll(/>/g, "&gt;")
        .replaceAll(/'/g, "&#39;")
        .replaceAll(/"/g, "&quot;")
        .replaceAll(/\x01(.*?)\x01/g, "<span class=\"$1\">")
        .replaceAll(/\x02/g, "</span>");
}

function filtergraphLang(hljs: HLJSApi) {
    const keyword =
        "alphamerge boxblur concat crop loop displace drawtext \
         drawvg format pad scale overlay split \
    ".split(/\s+/);

    return {
        name: "FilterGraph",
        keywords: { keyword },
        contains: [
            hljs.APOS_STRING_MODE,
            {
                className: "variable.constant",
                begin: /\[/,
                end: /\]/,
            },
        ]
    };
}
