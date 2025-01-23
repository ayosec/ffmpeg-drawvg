import { useCallback, useContext, useEffect, useReducer, useState } from "react";

import BackendContext from "../backend";
import IconButton from "../IconButton";
import Logs from "./Logs";
import { LogEvent } from "../render/protocol";
import { usePageVisible } from "../hooks";

import { FaTrash } from "react-icons/fa";
import { IoTimerOutline } from "react-icons/io5";
import { LuLogs } from "react-icons/lu";
import { PiMemoryLight } from "react-icons/pi";

import styles from "./monitors.module.css";

const GET_LOGS_FREQ = 1000 / 3;

const DEFAULT_MAX = 100;

const SerialNumber = {
    _last: Math.round(performance.now()),
    next() { return ++this._last; },
};

export type Row
    = { key: number; lostEvents: number; }
    | { key: number; logEvent: LogEvent; }
    ;

interface Content {
    rows: Row[];
    max: number;
}

interface RowChange {
    addRows?: Row[];
    setMax?: number;
    reset?: true,
};

enum Tab {
    Logs,
    RenderTime,
    MemoryUsage,
}

export default function MonitorsPanel() {

    const pageVisible = usePageVisible();

    const backend = useContext(BackendContext);

    const [ selectedTab, setSelectedTab ] = useState(Tab.Logs);

    const [ content, updateRows ] = useReducer(
        (content: Content, change: RowChange) => {
            let { rows, max } = content;

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

            if (change.reset)
                rows = [];

            return { rows, max };
        },
        { rows: [], max: DEFAULT_MAX },
    );

    const getEventsFromBackend = useCallback(() => {
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
                updateRows({ addRows });

            // TODO: notify syntax errors if `Invalid token` is found.
        });
    }, [ backend ]);

    useEffect(() => {
        if (!pageVisible)
            return;

        const task = setInterval(
            () => requestAnimationFrame(getEventsFromBackend),
            GET_LOGS_FREQ,
        );

        return () => { clearInterval(task); };
    }, [ getEventsFromBackend, pageVisible ]);

    const clear = useCallback(() => updateRows({ reset: true }), []);

    const ButtonTab = ({tab, children}: {tab: Tab, children: React.ReactNode}) => (
        <button
            role="tab"
            aria-selected={selectedTab == tab}
            onClick={() => setSelectedTab(tab)}
        >
            {children}
        </button>
    );

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

                    <ButtonTab tab={Tab.MemoryUsage}>
                        <IoTimerOutline /> Render Time
                    </ButtonTab>

                    <ButtonTab tab={Tab.RenderTime}>
                        <PiMemoryLight /> Memory Usage
                    </ButtonTab>
                </div>
            </div>

            <div className={styles.content}>
                <Logs rows={content.rows} />
            </div>
        </div>
    );
}
