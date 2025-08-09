import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { hash, randomBytes } from "node:crypto";
import { tmpdir } from "node:os";

import RunQueue from "./RunQueue";

interface Asset {
    uri: string;
    path: string;
}

interface Loop {
    duration: number;
    fps: number;
}

const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = 240;

const JOBS = new RunQueue();

const vgsOutput: (rootDir: string, render: string, code: string, options: string[]) => string = (
    function getPreview() {
        const PLAYGROUND_URL = process.env.PLAYGROUND_URL ?? "..";
        const FFMPEG_BIN = process.env.FFMPEG_BIN;

        if (PLAYGROUND_URL === undefined || FFMPEG_BIN === undefined)
            return (_a, _b, code) => `<pre>${code}</pre>`;

        return (rootDir, render, code, options) => (
            renderVGS(rootDir, PLAYGROUND_URL, FFMPEG_BIN, render, code, options)
        );
    }
)();

function renderVGS(
    rootDir: string,
    playgroundURL: string,
    ffmpegBin: string,
    render: string,
    code: string,
    options: string[],
) {
    const shareURL = playgroundURL + "#gzip=" + urlHash(code);

    const outputNames = makeOutputNames(rootDir, code);

    const loopDuration = getLoopDuration(options);

    let output;
    if (loopDuration === undefined) {
        const png = outputNames("png");
        const webp = outputNames("webp");

        renderImageFromProgram(ffmpegBin, code, png.path)?.then(() => {
            makeWebp(png.path, webp.path);
        });

        output = `
            <picture>
                <source
                    type="image/webp"
                    srcset="${webp.uri}"
                />
                <img
                    alt="Render of drawvg script"
                    src="${png.uri}"
                    loading="lazy"
                    width="${PREVIEW_WIDTH}"
                    height="${PREVIEW_HEIGHT}"
                />
            </picture>
        `;
    } else {
        const vp9 = outputNames("vp9.webm");
        renderVideoFromProgram(ffmpegBin, code, vp9.path, loopDuration);

        output = `
            <video muted loop controls>
                <source src="${vp9.uri}" type="video/webm" />
            </video>
        `;
    }

    return `
        <div class="vgs-output">
            <div class="code">${render}</div>

            <div class="output">${output}</div>

            <div class="actions">
                <a class="playground" href="${shareURL}" target="_blank">Play</a>
            </div>
        </div>
    `;
}

function urlHash(code: string): string {
    const bytes = Buffer.from(code.trimEnd(), "utf8");
    const gzipped = gzipSync(bytes, { level: 9 });

    return encodeURIComponent(gzipped.toString("base64"));
}

function makeOutputNames(rootDir: string, code: string): (s: string) => Asset {
    const OUTPUT = "outputs";

    const dirname = path.join(rootDir, OUTPUT);

    if (!fs.existsSync(dirname))
        fs.mkdirSync(dirname);

    const codeHash = hash("sha256", code, "base64url").substring(0, 16);

    return function(suffix: string) {
        const uri = `./${OUTPUT}/vgs-${codeHash}.${suffix}`;
        return {
            uri,
            path: path.join(rootDir, uri),
        };
    };
}

function renderImageFromProgram(ffmpegBin: string, code: string, pngPath: string) {
    if (fs.existsSync(pngPath))
        return;

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

function getLoopDuration(options: string[]): Loop|undefined {
    for (const option of options) {
        const m = /^loop\[(\d+)(@\d+)?\]$/.exec(option);
        if (m) {
            return {
                duration: +m[1],
                fps: m[2] ? +(m[2].substring(1)) : 60,
            };
        }
    }
}

function renderVideoFromProgram(
    ffmpegBin: string,
    code: string,
    outputPath: string,
    loopDuration: Loop,
) {

    if (fs.existsSync(outputPath))
        return;

    const tmpName = `${tmpdir()}/drawvg-${randomBytes(16).toString("base64url")}`;
    fs.writeFileSync(tmpName, code);

    const filter = `
        color=white:s=${PREVIEW_WIDTH}x${PREVIEW_HEIGHT}:r=${loopDuration.fps},
        format=bgr0,
        drawvg=file=${tmpName},
        format=yuv420p
    `;

    return JOBS.launch([
        ffmpegBin,
        "-v", "warning",
        "-hide_banner",
        "-f", "lavfi",
        "-i", filter,
        "-to", `${loopDuration.duration}`,
        "-c:v", "libvpx-vp9",
        outputPath,
    ]);
}

export default vgsOutput;
