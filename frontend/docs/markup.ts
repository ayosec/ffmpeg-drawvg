import fs from "node:fs";
import path from "node:path";

import { Marked, Token, Tokens } from "marked";
import { createDirectives } from "marked-directive";

import { Instructions } from "@backend/syntax";

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

    let headerCount = 0;
    let inCommandsSection = false;

    const walkTokens = (token: Token) => {
        switch (token.type) {
            case "heading": {
                let linkName = null;

                if (token.depth === 2)
                    inCommandsSection = token.text === "Commands";

                if (inCommandsSection) {
                    // If any of the child is a known drawvg command, add
                    // an `id="cmd_X"` attribute, and use it for the link
                    // reference in the sidebar.
                    for (const child of token.tokens!) {
                        if (child.type === "codespan" && Instructions.has(child.text)) {
                            (<any>child).vgsUseForHeader = true;
                            if (linkName === null)
                                linkName = commandLinkFor(child.text);
                        }
                    }
                }

                let needAnchor = false;
                const content = (token.tokens?.map(t => (<any>t).text).join("") ?? "")
                    .replace(/<.*?>/g, "");  // Remove HTML tags

                if (!linkName) {
                    linkName = content
                        .replace(/\W+/g, "_")   // Remove non-word characters.
                        .toLowerCase() + `_${++headerCount}`;
                    needAnchor = true;
                }

                headers.push({
                    content,
                    linkName,
                    level: token.depth,
                });

                if (needAnchor) {
                    token.tokens?.splice(0, 0, <any>{
                        type: "html",
                        text: `<a href="#${linkName}" name="${linkName}"></a>`
                    });
                }
                break;
            }

            case "code":
                applyHighlight(rootDir, token);
                break;

            case "link":
                // Convert `[!ref]` links to use the title as the link text.
                if (
                    typeof (token.title) === "string"
                    && /^![-\w]+$/.exec(token.text)
                    && token.tokens?.length === 1
                    && token.tokens[0].type === "text"
                ) {
                    const label = token.tokens[0];
                    label.text = new Marked({}).parseInline(token.title);
                    label.escaped = true;
                    delete token.title;
                }
                break;

            case "codespan":
                if (Instructions.has(token.text)) {
                    let html = <string>new Marked({}).parseInline(token.raw);
                    const ref = commandLinkFor(token.text);

                    if ((<any>token).vgsUseForHeader) {
                        html = html.replace(">", ` id="${ref}">`);
                    } else {
                        html = `<a href="#${ref}">${html}</a>`;
                    }

                    token.type = "html";
                    token.text = html;
                }
                break;
        }
    };

    const html = await new Marked({ walkTokens })
        .use(createDirectives())
        .parse(source, { gfm: true });

    return { headers, html };
}

function applyHighlight(rootDir: string, token: Token) {
    const { text, lang } = <Tokens.Code>token;
    if (lang === undefined || lang === "")
        return;

    const langParts = lang.split(",");

    const hl = highlight(
        langParts[0],
        text.trimEnd(),
        langParts.indexOf("nocolorwords") === -1,
        findSpanOpts(langParts),
    );

    let html = `<code class="hljs">${hl}</code>`;

    if (langParts[0] === "vgs" && langParts.indexOf("ignore") === -1) {
        html = vgsOutput(
            rootDir,
            `<pre>${html}</pre>`,
            text,
            langParts,
        );
    } else {
        html = `<pre class="standalone">${html}</pre>`;
    }

    const newToken = <Tokens.HTML>token;
    newToken.type = "html";
    newToken.text = html;
}

export function commandLinkFor(child: string): any {
    return "cmd_" + child;
}

function findSpanOpts(options: string[]) {
    return options
        .map(o => {
            const m = /^(error|mark)\[(\d+):(\d+):(\d+)\]$/.exec(o);
            if (m)
                return {
                    kind: m[1],
                    line: +m[2],
                    column: +m[3],
                    length: +m[4],
                };
        })
        .filter(o => o !== undefined);
}
