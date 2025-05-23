import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";

import tokenize from "@frontend/vgs/tokenizer";

hljs.registerLanguage("javascript", javascript);

export function themeURL(dark: boolean) {
    const suffix = dark ? "-dark" : "";
    return `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github${suffix}.min.css`;
}

export default function highlight(language: string, code: string) {
    if (language === "vgs")
        return hlVGS(code);

    return hljs.highlight(code, { language }).value;
}

const CSS_CLASSES: {[k: string]: string} ={
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
