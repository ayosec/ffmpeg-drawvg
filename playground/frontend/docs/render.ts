import fs from "node:fs";
import path from "node:path";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import DocView from "./DocView";

// The environment variable $DEST is expected to indicate
// the directory where files are written. The directory is
// created. It is created if missing.
const DOCS_DIR = (
    function getDEST() {
        const dest = process.env.DEST;
        if (typeof dest !== "string")
            throw "Missing DEST variable";

        if (!fs.existsSync(dest))
            fs.mkdirSync(dest, { recursive: true });

        return dest;
    }
)();

function writePage(filename: string, elem: React.ReactNode) {
    const timeLog = "DOCS: Rendering " + filename;
    console.time(timeLog);

    const fd = fs.openSync(path.join(DOCS_DIR, filename), "w");
    try {
        fs.writeSync(fd, "<!DOCTYPE html>\n");
        fs.writeSync(fd, renderToStaticMarkup(elem));
    } finally {
        fs.closeSync(fd);
    }

    console.timeLog(timeLog);
}

// Render pages.
const LANGREF_NAME = "langref.html";

DocView(DOCS_DIR, "LangRef.md", "").then(html => writePage(LANGREF_NAME, html));
DocView(DOCS_DIR, "Manual.md", LANGREF_NAME).then(html => writePage("manual.html", html));

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
