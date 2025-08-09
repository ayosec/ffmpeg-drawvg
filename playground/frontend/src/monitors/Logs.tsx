import { useLayoutEffect, useRef } from "react";

import { LogEvent } from "../render/protocol";
import { LogRow } from "./MonitorsPanel";

import styles from "./logs.module.css";

interface Props {
    rows: LogRow[];
    lastProgramId: number;
}

const LevelNames = new Map([
    [ -8, "Quiet" ],
    [ 0, "Panic" ],
    [ 8, "Fatal" ],
    [ 16, "Error" ],
    [ 24, "Warning" ],
    [ 32, "Info" ],
    [ 40, "Verbose" ],
    [ 48, "Debug" ],
    [ 56, "Trace" ],
]);

function makeLogEvent(key: number, logEvent: LogEvent, lastProgramId: number) {
    const levelName = LevelNames.get(logEvent.level) ?? logEvent.level.toString();

    const showVar = (varName: string, label: string, value: number, fixed?: number) => (
        isFinite(value) && <>
            <span data-field="variable" aria-label={label} data-name={varName}>
                {fixed ? value.toFixed(fixed) : value}
            </span>
        </>
    );

    let className = logEvent.level < 32 ? styles.error : styles.info;

    if (lastProgramId !== logEvent.programId)
        className += " " + styles.outdated;

    return (
        <div key={key} className={`${styles.event} ${className}`}>
            {
                logEvent.repeat > 1
                    ? <span
                        data-field="repeat"
                        title="Number of times the message was repeated"
                      >
                          {logEvent.repeat}
                      </span>
                    : <span data-field="level" aria-label={levelName}>●</span>
            }

            <span data-field="message">{logEvent.message}</span>

            { showVar("n", "Frame Number (n)", logEvent.varN, logEvent.varN % 1 === 0 ? undefined : 1) }

            { showVar("t", `Timestamp\nt = ${logEvent.varT.toFixed(4)}`, logEvent.varT, 2) }
        </div>
    );
}

function makeLostEvents(key: number, lostEvents: number) {
    return (
        <div key={key} className={styles.lostEvents}>
            {lostEvents} events lost.
        </div>
    );
}

export default function Logs({ rows, lastProgramId }: Props) {
    const container = useRef<HTMLDivElement>(null);

    // When `rows` is updated, and the scroll is close to the
    // bottom, updates the scroll after render.

    let needScrollToBottom = false;
    if (container.current !== null) {
        const { scrollTop, clientHeight, scrollHeight } = container.current;
        if ((scrollTop + clientHeight) > (scrollHeight * 0.95))
            needScrollToBottom = true;
    }

    useLayoutEffect(() => {
        const ref = container.current;
        if (ref !== null && needScrollToBottom) {
            ref.scrollTo(0, ref.scrollHeight);
        }

    }, [ rows, needScrollToBottom ]);

    const makeRow = (row: LogRow) => {
        if ("logEvent" in row)
            return makeLogEvent(row.key, row.logEvent, lastProgramId);
        else if ("lostEvents" in row)
            return makeLostEvents(row.key, row.lostEvents);
    };

    return (
        <div ref={container} role="log" className={styles.logs}>
            {rows.map(makeRow)}
        </div>
    );
}
