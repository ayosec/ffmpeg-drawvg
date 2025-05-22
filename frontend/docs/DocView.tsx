import React, { Fragment } from "react";

import HtmlFile from "./HtmlFile";
import renderMarkup, { Header } from "./markup";

interface Section {
    title: string;
    items: Header[];
}

export default function DocView(rootDir: string, filename: string): React.ReactNode {
    const markup = renderMarkup(rootDir, filename);

    const sections: Section[] = [];
    let currentSection: Section | null = null;

    for (const header of markup.headers) {
        switch (header.level) {
            case 1:
                currentSection = null;
                break;

            case 2:
                currentSection = {
                    title: header.content,
                    items: [],
                };

                sections.push(currentSection);
                break;

            case 3:
                if (currentSection)
                    currentSection.items.push(header);

                break;
        }
    }

    return (
        <HtmlFile title={markup.headers[0]?.content ?? "."}>
            <main>
                <aside>
                    <label id="showTOC">
                        Table of Contents
                        <input type="checkbox" />
                    </label>

                    <div className="sections">
                        <h1>drawvg</h1>

                        {
                            sections.map((section, i) =>
                                <details open key={i}>
                                    <summary>{section.title}</summary>
                                    {
                                        section.items.map((item, i) =>
                                            <Fragment key={i}>
                                                <a href={"#" + item.linkName}>
                                                    {item.content}
                                                </a>
                                                {" "}
                                            </Fragment>
                                        )
                                    }
                                </details>
                            )
                        }
                    </div>
                </aside>

                <section dangerouslySetInnerHTML={{ __html: markup.html }} />
            </main>
        </HtmlFile>
    );
}
