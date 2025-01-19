import { useCallback, useEffect, useReducer } from "react";

import Backend from "./backend";
import { LogEvent } from "./render/protocol";

const GET_LOGS_FREQ = 1000 / 3;

const SerialNumber = {
    _last: Math.round(performance.now()),
    next() { return ++this._last; },
};

type Row
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
};

export default function LogsPanel() {

    const [ content, updateRows ] = useReducer(
        (content: Content, change: RowChange) => {
            let { rows, max } = content;

            if (change.setMax)
                max = change.setMax;

            if (change.addRows) {
                const toRemove = (change.addRows.length + rows.length) - max;
                const prevRows = toRemove > 0 ? rows.slice(toRemove) : rows;
                rows = [ ...prevRows, ...change.addRows];
            }

            return { rows, max };
        },
        { rows: [], max: 10 },
    );

    const getEventsFromBackend = useCallback(() => {
        Backend.sendAction("GetLogs", (response) => {
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
    }, []);

    useEffect(() => {
        const task = setInterval(
            () => requestAnimationFrame(getEventsFromBackend),
            GET_LOGS_FREQ,
        );

        return () => { clearInterval(task); };
    }, [ getEventsFromBackend ]);

    return (
        <div>
            <div>{content.rows.map(e => <div key={e.key}>{JSON.stringify(e)}</div>)}</div>
        </div>
    );
}
