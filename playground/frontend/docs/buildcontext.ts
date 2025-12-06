import fs from "node:fs";
import { createHash } from "node:crypto";

import envPaths from "env-paths";

export const FFMPEG = (() => {
    const path = process.env.FFMPEG_BIN;
    let digest: Buffer|undefined = undefined;

    if (path !== undefined) {
        const srcHash = createHash("sha256");

        const src = fs.readFileSync(path);
        srcHash.update(src);
        srcHash.update("\n");

        digest = srcHash.digest();
    }


    return { path, digest };
})()

export const CACHE_DIR = envPaths("drawvg-playground").cache + "/outputs";

export const DOCS_URL = process.env.WEBSITE_URL
    ? `${process.env.WEBSITE_URL}/docs`
    : ".";

// The environment variable $DEST is expected to indicate
// the directory where files are written. The directory is
// created. It is created if missing.
export const DOCS_DIR = (
    function getDEST() {
        const dest = process.env.DEST;
        if (typeof dest !== "string")
            throw "Missing DEST variable";

        if (!fs.existsSync(dest))
            fs.mkdirSync(dest, { recursive: true });

        return dest;
    }
)();

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}
