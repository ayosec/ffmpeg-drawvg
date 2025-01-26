import { useCallback, useContext, useEffect, useReducer, useState } from "react";

import BackendContext from "../backend";
import { LogEvent, MemoryUsage, RenderTimeChunk, ResourceUsage } from "../render/protocol";
import { usePageVisible } from "../hooks";

import IconButton from "../IconButton";
import Logs from "./Logs";
import RenderTimeChart from "./RenderTimeChart";
import Select from "../Select";
import SerialNumber from "./serial";

import { FaTrash } from "react-icons/fa";
import { IoTimerOutline } from "react-icons/io5";
import { LuLogs } from "react-icons/lu";
import { PiMemoryLight } from "react-icons/pi";

import styles from "./monitors.module.css";

const GET_LOGS_FREQ = 1000 / 2;

const DEFAULT_LIMIT = 100;

export type Row
    = { key: number; lostEvents: number; }
    | { key: number; logEvent: LogEvent; }
    ;

interface Content {
    memoryUsageItems: MemoryUsage[];
    renderTimeChunks: RenderTimeChunk[];
    rows: Row[];
    limit: number;
}

interface RowChange {
    reset?: true,
    addRows?: Row[];
    resourceUsage?: ResourceUsage;
    setLimit?: number;
};

enum Tab {
    Logs,
    RenderTime,
    MemoryUsage,
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

function truncateList<T>(limit: number, items: T[]): T[] {
    const needRemove = items.length - limit;
    return needRemove > 0 ? items.slice(needRemove) : items;
}

function updateContentImpl(content: Content, change: RowChange): Content {
    let { memoryUsageItems, renderTimeChunks: renderTimeItems, rows, limit } = content;

    if (change.setLimit) {
        limit = change.setLimit;
        memoryUsageItems = truncateList(limit, memoryUsageItems);
        renderTimeItems = truncateList(limit, renderTimeItems);
        rows = truncateList(limit, rows);
    }

    if (change.addRows) {
        // Combine oldest event in `addRows` and newest event in `rows`
        // if they have the same contents.
        const a = change.addRows[0];
        const b = rows.at(-1);
        if (a && b && "logEvent" in a && "logEvent" in b) {
            const repeated =
                a.logEvent.className == b.logEvent.className
                    && a.logEvent.message == b.logEvent.message
                    && a.logEvent.level == b.logEvent.level;

            if (repeated) {
                rows.pop();
                a.logEvent.repeat += b.logEvent.repeat;
            }
        }

        rows = addToList(limit, rows, change.addRows);
    }

    if (change.resourceUsage) {
        const { memoryUsage, renderTimeChunk: renderTimes } = change.resourceUsage;

        if (memoryUsage !== undefined) {
            // Add the item if it is different to the last one.
            const last = memoryUsageItems.at(-1);
            if (last === undefined
                || last.totalFreeSpace != memoryUsage.totalFreeSpace
                || last.totalInUseSpace != memoryUsage.totalInUseSpace
            ) {
                memoryUsageItems = addToList(limit, memoryUsageItems, [memoryUsage]);
            }
        }

        if (renderTimes !== undefined && renderTimes.data.length > 0)
            renderTimeItems = addToList(limit, renderTimeItems, [ renderTimes ]);
    }

    if (change.reset) {
        memoryUsageItems = [];
        renderTimeItems = [];
        rows = [];
    }

    // Reuse the same object if there are no changes.
    if (
        content.limit == limit
        && Object.is(content.renderTimeChunks, renderTimeItems)
        && Object.is(content.memoryUsageItems, memoryUsageItems)
        && Object.is(content.rows, rows)
    ) {
        return content;
    }

    return { memoryUsageItems, renderTimeChunks: renderTimeItems, rows, limit };
}

const LIMIT_OPTIONS = [ 10, 100, 500, 1000 ];

export default function MonitorsPanel() {

    const pageVisible = usePageVisible();

    const backend = useContext(BackendContext);

    const [ selectedTab, setSelectedTab ] = useState(Tab.Logs);

    const [ content, updateContent ] = useReducer(updateContentImpl, {
        memoryUsageItems: [],
        renderTimeChunks: [],
        rows: [],
        limit: DEFAULT_LIMIT,
    });

    const setLimitHandler = useCallback(
        (value: number) => { updateContent({ setLimit: value }) },
        [ updateContent ],
    );

    const getDataFromBackend = useCallback(() => {
        backend.sendAction("GetLogs", (response) => {
            if (!("logs" in response))
                return;

            const addRows: Row[] = [];

            for (const logEvent of response.logs.events)
                addRows.push({ key: SerialNumber.next(), logEvent });

            const lostEvents = response.logs.lostEvents;
            if (lostEvents > 0)
                addRows.push({ key: SerialNumber.next(), lostEvents });

            if (addRows.length > 0)
                updateContent({ addRows });

            // TODO: notify syntax errors if `Invalid token` is found.
        });

        backend.sendAction("GetResourceUsage", (response) => {
            if ("resourceUsage" in response)
                updateContent({ resourceUsage: response.resourceUsage });
        });
    }, [ backend ]);

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

    let currentTab;
    switch (selectedTab) {
        case Tab.Logs:
            currentTab = <Logs rows={content.rows} />;
            break;

        case Tab.RenderTime:
            currentTab = <RenderTimeChart chunks={content.renderTimeChunks} />;
            break;

        case Tab.MemoryUsage:
            currentTab = <pre>{JSON.stringify(content.memoryUsageItems, null, 2)}</pre>;
            break;

        default:
            currentTab = selectedTab;
    }

    return (
        <div className={styles.monitors}>
            <div className={styles.toolbar}>
                <div role="tablist" className={styles.tabs}>
                    <ButtonTab tab={Tab.Logs}>
                        <LuLogs /> Logs
                    </ButtonTab>

                    <ButtonTab tab={Tab.RenderTime}>
                        <IoTimerOutline /> Render Time
                    </ButtonTab>

                    <ButtonTab tab={Tab.MemoryUsage}>
                        <PiMemoryLight /> Memory Usage
                    </ButtonTab>
                </div>

                <div className={styles.actions}>
                    <Select
                        title="Events limit"
                        value={content.limit}
                        onChange={setLimitHandler}
                        options={ LIMIT_OPTIONS }
                    />

                    <IconButton icon={FaTrash} onClick={clear} label="Clear" />
                </div>
            </div>

            <div className={styles.content}>
                {currentTab}
            </div>
        </div>
    );
}
