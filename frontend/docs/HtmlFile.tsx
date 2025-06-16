import fs from "node:fs";
import path from "node:path";

import postcss from "postcss";
import postcssCustomMedia from "postcss-custom-media";
import postcssDiscardComments from "postcss-discard-comments";
import postcssImport from "postcss-import";
import postcssNested from "postcss-nested";
import postcssNormalizeWhitespace from "postcss-normalize-whitespace";
import postcssReporter from "postcss-reporter";
import postcssUrl from "postcss-url";

import React from "react";

import { highlightThemeCSS } from "./highlight";

interface Props {
    title: string;
    children: React.ReactNode;
}

const CSS = await (
    async function loadCSS() {
        const filename = path.join(import.meta.dirname, "main.css");
        const source = fs.readFileSync(filename, "utf8");

        const processor = postcss([
            postcssImport({ resolve: highlightThemeCSS }),
            postcssNested,
            postcssCustomMedia,
            postcssUrl({ url: "inline" }),
            postcssDiscardComments({ removeAll: true }),
            postcssNormalizeWhitespace,
            postcssReporter({ throwError: true }),
        ]);

        const result = await processor.process(source, { from: filename });

        return result.css;
    }
)();

export default function HtmlFile({ title, children }: Props) {
    return (
        <html lang="en">
            <head>
                <meta charSet="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>{`FFmpeg - drawvg - ${title}`}</title>

                <style>{CSS}</style>
            </head>
            <body>
                {children}
            </body>
        </html>
    );
}
