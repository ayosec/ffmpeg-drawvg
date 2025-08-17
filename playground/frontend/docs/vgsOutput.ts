import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { hash, randomBytes } from "node:crypto";
import { tmpdir } from "node:os";

import RunQueue from "./RunQueue";
import { CACHE_DIR, DOCS_DIR, DOCS_URL } from "./buildcontext";

interface Asset {
    uri: string;
    path: string;
    build(builder: () => Promise<void>): Promise<void>;
}

interface Loop {
    duration: number;
    fps: number;
}

const OUTPUTS_DIR = "outputs";

const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = 240;

const JOBS = new RunQueue();

const vgsOutput: (render: string, code: string, options: string[]) => string = (
    function getPreview() {
        const PLAYGROUND_URL = process.env.PLAYGROUND_URL ?? "..";
        const FFMPEG_BIN = process.env.FFMPEG_BIN;

        if (PLAYGROUND_URL === undefined || FFMPEG_BIN === undefined)
            return (_a, _b, code) => `<pre>${code}</pre>`;

        return (render, code, options) => (
            renderVGS(PLAYGROUND_URL, FFMPEG_BIN, render, code, options)
        );
    }
)();

function renderVGS(
    playgroundURL: string,
    ffmpegBin: string,
    render: string,
    code: string,
    options: string[],
) {
    const shareURL = playgroundURL + "#gzip=" + urlHash(code);

    const outputNames = makeOutputNames(code);

    const loopDuration = getLoopDuration(options);

    let output;
    if (loopDuration === undefined) {
        const png = outputNames("png");
        const webp = outputNames("webp");

        renderImageFromProgram(ffmpegBin, code, png)?.then(() => {
            makeWebp(png, webp);
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
        renderVideoFromProgram(ffmpegBin, code, vp9, loopDuration);

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

function makeOutputNames(code: string): (s: string) => Asset {
    const dirname = path.join(DOCS_DIR, OUTPUTS_DIR);

    if (!fs.existsSync(dirname))
        fs.mkdirSync(dirname);

    const codeHash = hash("sha256", code, "base64url").substring(0, 16);

    return function(suffix: string) {
        const filename = `vgs-${codeHash}.${suffix}`;
        const filepath = path.join(DOCS_DIR, OUTPUTS_DIR, filename);
        return {
            uri: `${DOCS_URL}/${OUTPUTS_DIR}/${filename}`,

            path: filepath,

            async build(builder: () => Promise<void>) {
                if (fs.existsSync(filepath))
                    return;

                const cacheKey = hash("sha256", filepath, "hex");
                const cacheFile = path.join(CACHE_DIR, cacheKey);

                if (fs.existsSync(cacheFile)) {
                    fs.copyFileSync(cacheFile, filepath);
                    return;
                }

                // Render the output and copy it to the cache.

                await builder();

                fs.copyFileSync(filepath, cacheFile);
            }
        };
    };
}

function renderImageFromProgram(ffmpegBin: string, code: string, png: Asset) {
    return png.build(() => {
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
                png.path,
            ]).then(() => JOBS.launch(["optipng", png.path]))
        );
    });
}

function makeWebp(png: Asset, webp: Asset) {
    return webp.build(() => {
        return JOBS.launch(["cwebp", "-lossless", png.path, "-o", webp.path]);
    });
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
    output: Asset,
    loopDuration: Loop,
) {
    return output.build(() => {
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
            output.path,
        ]);
    });
}

export default vgsOutput;
