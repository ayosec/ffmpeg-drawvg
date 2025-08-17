import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

import { BsFillCameraReelsFill } from "react-icons/bs";
import { FaFileAlt } from "react-icons/fa";
import { LuCopy } from "react-icons/lu";
import { PiTerminalWindowFill } from "react-icons/pi";

import highlight from "../highlight";
import { CACHE_DIR, DOCS_DIR, DOCS_URL } from "../buildcontext";

interface Props {
    sources: string[];
    langRefURL: string;
}

interface Sources {
    files: {[key: string]: string};
    digest: string;
}

interface Rendered {
    fullURL: string;
    width: number;
    height: number;
}

export default function ExampleRender({ sources, langRefURL }: Props) {
    const data = readSources(sources);

    const sourcesView = sources.map((source, index) => (
        <div key={`src-${index}`} className="source">
            <div className="filename">
                { source.endsWith(".bash")
                    ? <span><PiTerminalWindowFill size="1.25em" />Shell</span>
                    : <span><FaFileAlt size="1em "/><code>{ source }</code></span>
                }
            </div>

            <pre className="example-code">
                <code
                    className="hljs"
                    dangerouslySetInnerHTML={{
                        __html: highlight(
                            source.split(".").at(-1) ?? "bash",
                            data.files[source],
                            true,
                            langRefURL,
                            []
                        )
                    }}
                />

                <div className="copy-button" data-src={ data.files[source] + "\n" }>
                    <LuCopy size="1.6em" />
                </div>
            </pre>
        </div>
    ));

    const render = renderSources(data);

    return (
        <div className="complex-example">
            <div className="source">
                <div className="filename">
                    <span><BsFillCameraReelsFill /> Output</span>
                </div>

                <div className="video-output">
                    <Video render={ render } />
                </div>
            </div>

            { sourcesView }
        </div>
    );
}

ExampleRender.Video = ({ sources }: { sources: string[] }) => {
    const render = renderSources(readSources(sources));

    return <div className="simple-video"><Video render={render} /></div>;
};

const Video = ({ render }: { render: Rendered }) => (
    <video muted controls width={ render.width } height={ render.height }>
        <source src={ render.fullURL } type="video/webm" />
    </video>
);

function readSources(sources: string[]): Sources {
    const files: Sources["files"] = {};

    const srcHash = createHash("sha256");

    for (const source of sources) {
        const src = fs.readFileSync(path.join(import.meta.dirname, source), "utf8");
        files[source] = src.trimEnd();
        srcHash.update(src);
        srcHash.update("\n");
    }

    const digest = srcHash.digest("base64url").substring(0, 16);

    return { files, digest };
}

const EXAMPLE_VIDEOS_PATH = fs.realpathSync(
    process.env.EXAMPLE_VIDEOS_PATH ?? "/tmp/example-videos"
);

function renderSources(source: Sources): Rendered {
    const filename = `outputs/example-${source.digest}.webm`;

    const fullURL = `${DOCS_URL}/${filename}`;

    const renderPath = path.join(DOCS_DIR, filename);

    if (!fs.existsSync(renderPath))
        executeRender(renderPath, source);

    const metadataCachePath = path.join(CACHE_DIR, `example-meta-${source.digest}.json`);

    if (!fs.existsSync(metadataCachePath)) {
        const stdout = fs.openSync(metadataCachePath, "w");

        spawnSync(
            "ffprobe",
            [
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-print_format", "json",
                "-i", renderPath,
            ], {
                stdio: [ "ignore", stdout, "inherit" ],
                timeout: 10_000,
                killSignal: "SIGKILL",
            },
        );

        fs.closeSync(stdout);
    }

    const { width, height } = JSON.parse(fs.readFileSync(metadataCachePath, "utf8")).streams[0];

    return { fullURL, width, height };
}

function executeRender(renderPath: string, source: Sources) {

    const cachePath = path.join(CACHE_DIR, "example-" + source.digest);

    // Render the video if it is not in the cache.
    if (!fs.existsSync(cachePath)) {
        const workdir = `${tmpdir()}/drawvg-example-${randomBytes(16).toString("base64url")}`;

        fs.mkdirSync(workdir);

        let renderScript = null;

        // Write source files.
        for (const [ filename, content ] of Object.entries(source.files)) {
            fs.writeFileSync(path.join(workdir, filename), content);

            if (filename.endsWith(".bash")) {
                if (renderScript)
                    throw `Too many .bash files: ${filename}, ${renderScript}`;

                renderScript = filename;
            }
        }

        if (!renderScript)
            throw `Missing .bash file in ${Object.keys(source.files).join(" ")}`;

        // Link example videos.
        for (const filename of fs.readdirSync(EXAMPLE_VIDEOS_PATH)) {
            if (filename.startsWith("."))
                continue;

            fs.symlinkSync(
                path.join(EXAMPLE_VIDEOS_PATH, filename),
                path.join(workdir, filename),
            );
        }

        const logFilePath = path.join(workdir, "render.log");

        console.log("[RENDER]", logFilePath);

        const logFile = fs.openSync(logFilePath, "a");

        const run = spawnSync(
            "bash",
            [ "-xe", renderScript ],
            {
                timeout: 600_000,
                killSignal: "SIGKILL",
                cwd: workdir,
                stdio: [ "ignore", logFile, logFile ],
                env: {
                    "BASH_FUNC_ffmpeg%%": '() { "$FFMPEG_BIN" "$@"; }',
                    ...process.env
                },
            },
        );

        const outputPath = path.join(workdir, "output.webm");

        fs.closeSync(logFile);

        if (run.status !== 0 || !fs.existsSync(outputPath)) {
            console.log(`=== ${logFilePath} ===`);
            console.log(fs.readFileSync(logFilePath, "utf8"));
            console.log(`======`);

            throw `Script failed: ${renderScript}`;
        }

        // Copy the `output.webm` generated by the script.
        fs.copyFileSync(outputPath, cachePath);
    }

    fs.copyFileSync(cachePath, renderPath);
}
