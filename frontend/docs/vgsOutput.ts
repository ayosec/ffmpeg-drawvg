import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { hash, randomBytes } from "node:crypto";
import { tmpdir } from "node:os";

import RunQueue from "./RunQueue";

const PREVIEW_WIDTH = 320;
const PREVIEW_HEIGHT = 240;

const JOBS = new RunQueue();

const vgsOutput: (rootDir: string, render: string, code: string) => string = (
    function getPreview() {
        const PLAYGROUND_URL = process.env.PLAYGROUND_URL;
        const FFMPEG_BIN = process.env.FFMPEG_BIN;

        if (PLAYGROUND_URL === undefined || FFMPEG_BIN === undefined)
            return (_a, _b, code) => `<pre>${code}</pre>`;

        return (rootDir, render, code) => (
            renderVGS(rootDir, PLAYGROUND_URL, FFMPEG_BIN, render, code)
        );
    }
)();

function renderVGS(
    rootDir: string,
    playgroundURL: string,
    ffmpegBin: string,
    render: string,
    code: string,
) {
    const shareURL = playgroundURL + "#gzip=" + urlHash(code);

    const outputNames = makeOutputNames(code);
    const png = outputNames("png");
    const webp = outputNames("webp");

    renderProgram(ffmpegBin, code, path.join(rootDir, png))?.then(() => {
        makeWebp(path.join(rootDir, png), path.join(rootDir, webp));
    });

    return `
        <div class="vgs-output">
            <div class="code">${render}</div>

            <div class="output">
                <picture style="min-width:${PREVIEW_WIDTH}px;min-height:${PREVIEW_HEIGHT}px;">
                    <source
                        type="image/webp"
                        srcset="${webp}"
                    />
                    <img
                        alt="Output of the drawvg program"
                        src="${png}"
                        loading="lazy"
                    />
                </picture>
            </div>

            <div class="actions">
                <a class="playground" href="${shareURL}" target="_blank">Playground</a>
            </div>
        </div>
    `;
}

function urlHash(code: string): string {
    const bytes = Buffer.from(code.trimEnd(), "utf8");
    const gzipped = gzipSync(bytes, { level: 9 });

    return encodeURIComponent(gzipped.toString("base64"));
}

function makeOutputNames(code: string) {
    const codeHash = hash("sha256", code, "base64url").substring(0, 16);
    return (suffix: string) => `./outputs/vgs-${codeHash}.${suffix}`;
}

function renderProgram(ffmpegBin: string, code: string, pngPath: string) {
    if (fs.existsSync(pngPath))
        return;

    const dirname = path.dirname(pngPath);
    if (!fs.existsSync(dirname))
        fs.mkdirSync(dirname);

    const tmpName = `${tmpdir()}/drawvg-${randomBytes(16).toString("base64url")}`;
    fs.writeFileSync(tmpName, code);

    const filter = `
        color=white:s=${PREVIEW_WIDTH}x${PREVIEW_HEIGHT}:r=1,
        format=bgr0,
        drawvg=file=${tmpName}
    `;

    return (
        JOBS.launch([
            ffmpegBin,
            "-hide_banner",
            "-f", "lavfi",
            "-i", filter,
            "-vframes", "1",
            "-update", "true",
            pngPath,
        ]).then(() => JOBS.launch(["optipng", pngPath]))
    );
}

function makeWebp(pngPath: string, webpPath: string) {
    if (fs.existsSync(webpPath))
        return;

    JOBS.launch(["cwebp", "-lossless", pngPath, "-o", webpPath]);
}

export default vgsOutput;
