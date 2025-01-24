import { useCallback, useContext, useEffect, useReducer, useState } from "react";

import BackendContext from "../backend";
import IconButton from "../IconButton";
import Logs from "./Logs";
import { LogEvent, MemoryUsage, RenderTime, ResourceUsage } from "../render/protocol";
import { usePageVisible } from "../hooks";

import { FaTrash } from "react-icons/fa";
import { IoTimerOutline } from "react-icons/io5";
import { LuLogs } from "react-icons/lu";
import { PiMemoryLight } from "react-icons/pi";

import styles from "./monitors.module.css";

const GET_LOGS_FREQ = 1000 / 2;

const DEFAULT_LIMIT = 100;

const SerialNumber = {
    _last: Math.round(performance.now()),
    next() { return ++this._last; },
};

export type Row
    = { key: number; lostEvents: number; }
    | { key: number; logEvent: LogEvent; }
    ;

interface Content {
    memoryUsageItems: MemoryUsage[];
    renderTimeItems: RenderTime[];
    rows: Row[];
    max: number;
}

interface RowChange {
    reset?: true,
    addRows?: Row[];
    resourceUsage?: ResourceUsage;
    setMax?: number;
};

enum Tab {
    Logs,
    RenderTime,
    MemoryUsage,
}

function updateContentImpl(content: Content, change: RowChange): Content {
    let { memoryUsageItems, renderTimeItems, rows, max } = content;

    if (change.setMax)
        max = change.setMax;

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

        const toRemove = (change.addRows.length + rows.length) - max;
        const prevRows = toRemove > 0 ? rows.slice(toRemove) : rows;
        rows = [ ...prevRows, ...change.addRows];
    }

    if (change.resourceUsage) {
        const { memoryUsage, renderTime } = change.resourceUsage;

        if (memoryUsage !== undefined) {
            // Add the item if it is different to the last one.
            const last = memoryUsageItems.at(-1);
            if (last === undefined
                || last.totalFreeSpace != memoryUsage.totalFreeSpace
                || last.totalInUseSpace != memoryUsage.totalInUseSpace
            ) {
                memoryUsageItems.push(memoryUsage);
                if (memoryUsageItems.length > max)
                    memoryUsageItems.splice(0, memoryUsageItems.length - max);
            }
        }

        if (renderTime !== undefined) {
            renderTimeItems.push(renderTime);
            if (renderTimeItems.length > max)
                renderTimeItems.splice(0, renderTimeItems.length - max);
        }
    }

    if (change.reset)
        rows = [];

    return { memoryUsageItems, renderTimeItems, rows, max };
}

export default function MonitorsPanel() {

    const pageVisible = usePageVisible();

    const backend = useContext(BackendContext);

    const [ selectedTab, setSelectedTab ] = useState(Tab.Logs);

    const [ content, updateContent ] = useReducer(updateContentImpl, {
        memoryUsageItems: [],
        renderTimeItems: [],
        rows: [],
        max: DEFAULT_LIMIT,
    });

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
            currentTab = <pre>{JSON.stringify(content.renderTimeItems, null, 2)}</pre>;
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
                <div className={styles.actions}>
                    <IconButton icon={FaTrash} onClick={clear} label="Clear" />
                </div>

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
            </div>

            <div className={styles.content}>
                {currentTab}
            </div>
        </div>
    );
}
