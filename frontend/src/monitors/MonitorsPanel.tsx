import { memo, useCallback, useContext, useEffect, useReducer, useState } from "react";

import BackendContext from "../BackendContext";
import IconButton from "../base/IconButton";
import Logs from "./Logs";
import OutputPanel from "../output/OutputPanel";
import RenderTimeChart from "./RenderTimeChart";
import Select from "../base/Select";
import SerialNumber from "../utils/serial";
import tokenize from "../vgs/tokenizer";
import useCurrentProgram, { CompilerError } from "../currentProgram";
import { Instructions } from "@backend/syntax";
import { LogEvent, RenderTimeChunk, ResourceUsage } from "../render/protocol";
import { usePageVisible } from "../utils/hooks";

import { HiOutlineTrash } from "react-icons/hi2";
import { IoTimerOutline } from "react-icons/io5";
import { LuLogs } from "react-icons/lu";

import styles from "./monitors.module.css";

interface Props {
    renderOutput?: boolean;
}

const GET_LOGS_FREQ = 1000 / 2;

export type LogRow
    = { key: number; lostEvents: number; }
    | { key: number; logEvent: LogEvent; }
    ;

interface Content {
    renderTimeChunks: RenderTimeChunk[];
    renderTimeCount: number;
    renderTimeLimit: number;

    logs: LogRow[];
    logsLimit: number;
}

interface RowChange {
    reset?: true,
    addRows?: LogRow[];
    resourceUsage?: ResourceUsage;
    setLogsLimit?: number;
    setRenderTimeLimit?: number;
};

enum Tab {
    Output,
    Logs,
    RenderTime,
}

function addToList<T>(limit: number, list: T[], newItems: T[]): T[] {
    const nl = newItems.length;

    if (nl === limit)
        return newItems;

    if (nl > limit)
        return newItems.slice(nl - limit);

    const needRemove = list.length + nl - limit;
    if (needRemove < 1)
        return [...list, ...newItems];

    return [...list.slice(needRemove), ...newItems];
}

function updateContentImpl(content: Content, change: RowChange): Content {
    let { renderTimeChunks, renderTimeCount, renderTimeLimit, logs, logsLimit } = content;

    if (change.setLogsLimit) {
        logsLimit = change.setLogsLimit;

        const needRemove = logs.length - logsLimit;
        if (needRemove > 0)
            logs = logs.slice(needRemove);
    }

    if (change.setRenderTimeLimit) {
        renderTimeLimit = change.setRenderTimeLimit;
    }

    if (change.addRows) {
        // Combine oldest event in `addRows` and newest event in `rows`
        // if they have the same contents.
        const a = change.addRows[0];
        const b = logs.at(-1);
        if (a && b && "logEvent" in a && "logEvent" in b) {
            const repeated =
                a.logEvent.className == b.logEvent.className
                    && a.logEvent.message == b.logEvent.message
                    && a.logEvent.level == b.logEvent.level;

            if (repeated) {
                logs.pop();
                a.logEvent.repeat += b.logEvent.repeat;
            }
        }

        logs = addToList(logsLimit, logs, change.addRows);
    }

    if (change.resourceUsage) {
        const { renderTimeChunk } = change.resourceUsage;

        if (renderTimeChunk !== undefined && renderTimeChunk.data.length > 0) {
            renderTimeCount += renderTimeChunk.data.length;
            renderTimeChunks = [...renderTimeChunks, renderTimeChunk ];
        }
    }

    if (change.reset) {
        renderTimeCount = 0;
        renderTimeChunks = [];
        logs = [];
    }

    while (renderTimeCount > renderTimeLimit) {
        renderTimeCount -= renderTimeChunks[0].data.length;

        if (Object.is(content.renderTimeChunks, renderTimeChunks))
            renderTimeChunks = renderTimeChunks.slice(1);
        else
            renderTimeChunks.splice(0, 1);
    }

    // Reuse the same object if there are no changes.
    if (
        content.logsLimit == logsLimit
            && content.renderTimeCount == renderTimeCount
            && content.renderTimeLimit == renderTimeLimit
            && Object.is(content.renderTimeChunks, renderTimeChunks)
            && Object.is(content.logs, logs)
    ) {
        return content;
    }

    return { renderTimeChunks, renderTimeCount, renderTimeLimit, logs, logsLimit };
}

const LOGS_LIMIT_OPTIONS: [number, string][] =
    [ 10, 100, 500, 1000 ].map(n => [n, `${n} messages`]);

const RENDER_TIME_LIMIT_OPTIONS: [number, string][] =
    [ 120, 600, 1200, 3000 ].map(n => [n, `${n} frames`]);

const IconLogs = memo(LuLogs);
const IconTimer = memo(IoTimerOutline);

export default function MonitorsPanel({ renderOutput }: Props) {
    const programId = useCurrentProgram(s => s.programId);
    const source = useCurrentProgram(s => s.source);
    const setCompilerError = useCurrentProgram(s => s.setCompilerError);

    const pageVisible = usePageVisible();

    const backend = useContext(BackendContext);

    const [ selectedTab, setSelectedTab ] = useState(renderOutput ? Tab.Output : Tab.Logs);

    const [ content, updateContent ] = useReducer(updateContentImpl, {
        renderTimeChunks: [],
        renderTimeCount: 0,
        renderTimeLimit: 600,
        logs: [],
        logsLimit: 100,
    });

    const getDataFromBackend = useCallback(() => {
        backend.sendAction("GetLogs", (response) => {
            if (!("logs" in response))
                return;

            const addRows: LogRow[] = [];

            for (const logEvent of response.logs.events)
                addRows.push({ key: SerialNumber.next(), logEvent });

            const lostEvents = response.logs.lostEvents;
            if (lostEvents > 0)
                addRows.push({ key: SerialNumber.next(), lostEvents });

            if (addRows.length > 0) {
                updateContent({ addRows });

                // Detect compiler messages
                let compilerError: CompilerError|undefined = undefined;

                for (const row of addRows) {
                    if ("logEvent" in row) {
                        const msg = /^Invalid token '(.+)' at line (\d+), column (\d+): (.*)/
                            .exec(row.logEvent.message);

                        if (msg !== null) {
                            compilerError = {
                                programId: row.logEvent.programId,
                                token: msg[1],
                                line: parseFloat(msg[2]),
                                column: parseFloat(msg[3]),
                                message: msg[4],
                            };
                        }
                    }
                }

                if (compilerError && compilerError.programId === programId) {
                    // If the token is a known instruction, assume that the
                    // error is part of the previous instruction.
                    //
                    // The span is moved to the first whitespace after the
                    // instruction before the error reported by the compiler.
                    if (Instructions.has(compilerError.token)) {
                        const { line, column } = compilerError;

                        let lastWS = undefined;

                        for (const token of tokenize(source)) {
                            if (token.line >= line && token.column >= column)
                                break;

                            if (lastWS === undefined
                                && token.kind === "whitespace"
                                && token.lexeme.indexOf("\n") !== -1
                            ) {
                                lastWS = token;
                            } else if(token.kind === "keyword") {
                                lastWS = undefined;
                            }
                        }

                        if (lastWS !== undefined) {
                            compilerError.line = lastWS.line;
                            compilerError.column = lastWS.column;
                        }
                    }

                    setCompilerError(compilerError);
                }
            }
        });

        backend.sendAction("GetResourceUsage", (response) => {
            if ("resourceUsage" in response)
                updateContent({ resourceUsage: response.resourceUsage });
        });
    }, [ backend, programId, source, setCompilerError ]);

    useEffect(() => {
        if (!pageVisible)
            return;

        const task = setInterval(getDataFromBackend, GET_LOGS_FREQ);

        return () => { clearInterval(task); };
    }, [ getDataFromBackend, pageVisible ]);

    const clear = useCallback(() => updateContent({ reset: true }), []);

    const ButtonTab = useCallback(({tab, children}: {tab: Tab, children: React.ReactNode}) => (
        <button
            role="tab"
            aria-selected={selectedTab == tab}
            onClick={() => setSelectedTab(tab)}
        >
            {children}
        </button>
    ), [ selectedTab ]);

    let currentTab, limitSetting;
    switch (selectedTab) {
        case Tab.Output:
            currentTab = <OutputPanel />;
            break;

        case Tab.Logs:
            currentTab = <Logs rows={content.logs} lastProgramId={programId} />;

            limitSetting = (
                <Select
                    title="Messages Limit"
                    key="setLogsLimit"
                    optionsAlign="right"
                    value={content.logsLimit}
                    valueLabel={content.logsLimit}
                    onChange={n => updateContent({ setLogsLimit: n })}
                    options={LOGS_LIMIT_OPTIONS}
                />
            );
            break;

        case Tab.RenderTime:
            currentTab = <RenderTimeChart chunks={content.renderTimeChunks} />;

            limitSetting = (
                <Select
                    title="Samples Limit"
                    key="setRenderTimeLimit"
                    optionsAlign="right"
                    value={content.renderTimeLimit}
                    valueLabel={content.renderTimeLimit}
                    onChange={n => updateContent({ setRenderTimeLimit: n })}
                    options={RENDER_TIME_LIMIT_OPTIONS}
                />
            );
            break;
    }

    return (
        <div className={styles.monitors}>
            <div className={styles.toolbar}>
                <div role="tablist" className={styles.tabs}>
                    { renderOutput &&
                        <ButtonTab tab={Tab.Output}>
                            <IconLogs /> Output
                        </ButtonTab>
                    }

                    <ButtonTab tab={Tab.Logs}>
                        <IconLogs /> Console
                    </ButtonTab>

                    <ButtonTab tab={Tab.RenderTime}>
                        <IconTimer /> Render Time
                    </ButtonTab>
                </div>

                <div className={styles.actions}>
                    {limitSetting}

                    <IconButton Icon={HiOutlineTrash} onClick={clear} label="Clear" />
                </div>
            </div>

            <div role="tabpanel" className={styles.content}>
                {currentTab}
            </div>
        </div>
    );
}
