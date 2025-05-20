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

writePage("langref.html", DocView("LangRef.md"));
