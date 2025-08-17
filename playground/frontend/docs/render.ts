import fs from "node:fs";
import path from "node:path";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import DocView from "./DocView";
import Landing from "./landing/Landing";
import { DOCS_DIR } from "./buildcontext";

function writePage(filename: string, elem: React.ReactNode) {
    const timeLog = "DOCS: Rendering " + filename;
    console.time(timeLog);

    const html = renderToStaticMarkup(elem);
    fs.writeFileSync(path.join(DOCS_DIR, filename), "<!DOCTYPE html>\n" + html);

    console.timeLog(timeLog);
}

// Render pages.
const LANGREF_NAME = "langref.html";

Landing(LANGREF_NAME).then(html => writePage("landing.html", html));
DocView("LangRef.md", "").then(html => writePage(LANGREF_NAME, html));
DocView("Manual.md", LANGREF_NAME).then(html => writePage("manual.html", html));

// Copy SVG files.
const ASSETS = path.join(import.meta.dirname, "assets");
for (const filename of fs.readdirSync(ASSETS)) {
    if (filename.startsWith("."))
        continue;

    const src = path.join(ASSETS, filename);
    const srcStat = fs.statSync(src);

    const dest = path.join(DOCS_DIR, filename);

    if (fs.existsSync(dest)) {
        const destStat = fs.statSync(dest);

        if (Math.floor(destStat.mtimeMs / 1000) === Math.floor(srcStat.mtimeMs / 1000))
            continue;
    }

    console.log("[COPY]", filename);
    fs.copyFileSync(src, dest);
    fs.utimesSync(dest, srcStat.atimeMs / 1000, srcStat.mtimeMs / 1000);
}
