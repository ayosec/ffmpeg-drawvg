import fs from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";

import { Fragment } from "react";
import { marked } from "marked";

import Content from "./Content";
import HtmlFile from "../HtmlFile";

export default async function Landing(langRefName: string) {
    const introduction = await loadIntroFromReadme();

    const E = process.env;

    const repoURL = `${E.GITHUB_SERVER_URL}/${E.GITHUB_REPOSITORY}`;

    const docsURL = E.WEBSITE_URL ? `${E.WEBSITE_URL}/docs/` : "./";

    const langRefURL = docsURL + langRefName;

    const playgroundURL = E.WEBSITE_URL ?? "..";

    const examples = Content.Examples.map(example =>
        <Fragment key={example.link}>
            <a href={"#" + example.link}>{example.title}</a>{" "}
        </Fragment>
    );

    return (
        <HtmlFile title="FFmpeg - drawvg">
            <main className="landing">
                <aside>
                    <label id="showTOC">
                        Table of Contents
                        <input type="checkbox" />
                    </label>

                    <div className="sections">
                        <h1>drawvg</h1>

                        <a href={ repoURL }>Source Code</a>
                        <a href={ playgroundURL }>Playground</a>
                        <a href={ docsURL + langRefName }>Language Reference</a>

                        <details open data-title="Examples">
                            <summary>Examples</summary>
                            { examples }
                        </details>
                    </div>
                </aside>

                <section>
                    <Content
                        introduction={ introduction }
                        langRefURL={ langRefURL }
                        playgroundURL={ playgroundURL }
                    />
                </section>

                <script>
                    { readFileSync(path.join(import.meta.dirname, "landing.js"), "utf8") }
                </script>
            </main>
        </HtmlFile>
    );
}

async function loadIntroFromReadme() {
    const README = path.join(import.meta.dirname, "../../../../README.md");

    const data = await fs.readFile(README, { encoding: "utf-8" });
    const intro = /<!--\s*landing:intro\s*-->(.*)<!--\s*\/landing:intro\s*-->/s.exec(data);
    if (intro === null)
        return "";

    return await marked(intro[1]);
}
