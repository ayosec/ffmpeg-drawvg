import fs from "node:fs";
import path from "node:path";

import { Parser, HtmlRenderer, Node } from "commonmark";

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

export default function renderMarkup(rootDir: string, filename: string): MarkupDocument {
    const fullPath = path.join(import.meta.dirname, filename);
    const source = fs.readFileSync(fullPath, "utf-8");

    const parser = new Parser();
    const nodes = parser.parse(source);

    const headers: Header[] = [];

    let event;
    let textFragments: string[] | null = null;

    const walker = nodes.walker();
    while ((event = walker.next()) != null) {
        switch (event.node.type) {
            case "code":
            case "text":
                if (event.entering && textFragments !== null)
                    textFragments.push(event.node.literal ?? "");
                break;

            case "heading":
                if (event.entering) {
                    textFragments = [];
                } else if (textFragments) {
                    const content = textFragments.join("");
                    const linkName = content.replace(/\W/g, "_").toLowerCase();

                    textFragments = null;

                    headers.push({
                        content,
                        linkName,
                        level: event.node.level,
                    });

                    const link = new Node("html_inline");
                    link.literal = `<a name="${linkName}"></a>`;
                    event.node.prependChild(link);
                }
                break;

            case "code_block":
                applyHighlight(rootDir, event.node);
                break;
        }
    }

    const htmlRenderer = new HtmlRenderer({ safe: false });
    return {
        headers,
        html: htmlRenderer.render(nodes),
    };
}

function applyHighlight(rootDir: string, node: Node) {
    const { info, literal } = node;
    if (info === null || literal === null)
        return null;

    const hl = highlight(info, literal.trimEnd());

    const render = new Node("html_block");
    render.literal = `<pre><code class="hljs">${hl}</code></pre>`

    if (info === "vgs")
        render.literal = vgsOutput(rootDir, render.literal, literal);

    node.insertBefore(render);
    node.unlink();
}
