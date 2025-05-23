import fs from "node:fs";
import path from "node:path";

import { Marked, Token, Tokens } from "marked";

import highlight from "./highlight";
import vgsOutput from "./vgsOutput";

export interface Header {
    level: number;
    linkName: string;
    content: string;
}

interface MarkupDocument {
    headers: Header[];
    html: string;
}

export default async function renderMarkup(rootDir: string, filename: string): Promise<MarkupDocument> {
    const fullPath = path.join(import.meta.dirname, filename);
    const source = fs.readFileSync(fullPath, "utf-8");

    const headers: Header[] = [];

    const walkTokens = (token: Token) => {
        switch (token.type) {
            case "heading": {
                const content = token.tokens?.map(t => (<any>t).text).join("") ?? "";
                const linkName = content.replace(/\W+/g, "_").toLowerCase();

                headers.push({
                    content,
                    linkName,
                    level: token.depth,
                });

                token.tokens?.splice(0, 0, <any>{
                    type: "html",
                    text: `<a name="${linkName}"></a>`
                });
                break;
            }

            case "code":
                applyHighlight(rootDir, token);
        }
    };

    const html = await new Marked({ walkTokens }).parse(source, { gfm: true });

    return { headers, html };
}

function applyHighlight(rootDir: string, token: Token) {
    const { text, lang } = <Tokens.Code>token;
    if (lang === undefined)
        return;

    const hl = highlight(lang, text.trimEnd());

    let html = `<pre><code class="hljs">${hl}</code></pre>`;

    if (lang === "vgs")
        html = vgsOutput(rootDir, html, text);

    const newToken = <Tokens.HTML>token;
    newToken.type = "html";
    newToken.text = html;
}
