import { useEffect, useState } from "react";

import Backend from "./backend";
import { LogEvent } from "./render/protocol";

const GET_LOGS_FREQ = 1000 / 2;

function getLogs(
    setLogEvents: (e: LogEvent[]) => void,
    setLostEvents: (n: number) => void
) {
    Backend.sendAction("GetLogs", (response) => {
        if ("logs" in response && response.logs.events.length > 0) {
            setLogEvents(response.logs.events);
            setLostEvents(response.logs.lostEvents);
        }
    });
}

export default function LogsPanel() {

    const [ logEvents, setLogEvents ] = useState<LogEvent[]>([]);

    const [ lostEvents, setLostEvents ] = useState(0);

    useEffect(() => {
        const task = setInterval(
            () => {
                requestAnimationFrame(() => {
                    getLogs(setLogEvents, setLostEvents);
                });
            },
            GET_LOGS_FREQ
        );

        return () => { clearInterval(task); };
    }, []);

    return (
        <div>
            <div>{lostEvents}</div>
            <div>{JSON.stringify(logEvents)}</div>
        </div>
    );
}
