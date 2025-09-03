import fs from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";

import { marked } from "marked";

import { AiOutlineExperiment } from "react-icons/ai";
import { LiaGit } from "react-icons/lia";
import { LuBookText } from "react-icons/lu";

import Content from "./Content";
import HtmlFile from "../HtmlFile";

export default async function Landing(langRefName: string) {
    const introduction = await loadIntroFromReadme();

    const E = process.env;

    const repoURL = `${E.GITHUB_SERVER_URL}/${E.GITHUB_REPOSITORY}`;

    const docsURL = E.WEBSITE_URL ? `${E.WEBSITE_URL}/docs/` : "./";

    const langRefURL = docsURL + langRefName;

    const playgroundURL = E.WEBSITE_URL ?? "..";

    const title = "FFmpeg - drawvg";

    const titleElem = repoURL
        ? <a href={repoURL} target="_blank">{title}</a>
        : title;

    return (
        <HtmlFile title="FFmpeg - drawvg">
            <main className="landing">
                <nav>
                    <div className="title">{titleElem}</div>

                    <div className="links">
                        <a href={ playgroundURL }>
                            <AiOutlineExperiment size="1.5rem" />
                            <span>Playground</span>
                        </a>

                        <a href={ docsURL + langRefName }>
                            <LuBookText size="1.5rem" />
                            <span>Language Reference</span>
                        </a>

                        <a href={ repoURL }>
                            <LiaGit size="1.5rem" />
                            <span>Source Code</span>
                        </a>
                    </div>
                </nav>

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
