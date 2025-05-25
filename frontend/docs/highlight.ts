import fs from "node:fs";
import path from "node:path";
import { hash } from "node:crypto";
import { tmpdir } from "node:os";

import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";

import tokenize from "@frontend/vgs/tokenizer";

hljs.registerLanguage("javascript", javascript);

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

    const data = await response.arrayBuffer()
    fs.writeFileSync(fileName, new DataView(data));

    return fileName;
}

export default function highlight(language: string, code: string) {
    if (language === "vgs")
        return hlVGS(code);

    return hljs.highlight(code, { language }).value;
}

const CSS_CLASSES: { [k: string]: string } = {
    "comment": "comment",
    "expr": "string",
    "keyword": "title function_",
    "number": "number",
};

function hlVGS(code: string) {
    const spans = [];

    for (const token of tokenize(code)) {
        const cls = CSS_CLASSES[token.kind];

        const lexeme = token.lexeme
            .replaceAll(/&/g, "&amp;")
            .replaceAll(/</g, "&gt;")
            .replaceAll(/>/g, "&lt;")
            .replaceAll(/'/g, "&#39;")
            .replaceAll(/"/g, "&quot;");

        if (cls)
            spans.push(`<span class="hljs-${cls}">${lexeme}</span>`);
        else
            spans.push(`${lexeme}`);
    }

    return spans.join("");
}
