import styles from "./monitors.module.css";
import { LogEvent } from "../render/protocol";
import { Row } from "./MonitorsPanel";
import { BiSolidError, BiSolidInfoCircle } from "react-icons/bi";

interface Props {
    rows: Row[];
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

function makeLogEvent(logEvent: LogEvent) {
    const levelName = LevelNames.get(logEvent.level) ?? logEvent.level.toString();

    return <>
        <td data-field="level" title={levelName}>
            {
                logEvent.level < 32
                    ? <BiSolidError className={styles.error} />
                    : <BiSolidInfoCircle className={styles.info} />
            }
        </td>

        <td data-field="class-name">{logEvent.className}</td>

        <td>{logEvent.message}</td>

        { logEvent.repeat > 0
            && <td data-field="repeat">{logEvent.repeat}</td> }
    </>;
}

function makeRow(row: Row) {
    let columns;
    if ("logEvent" in row)
        columns = makeLogEvent(row.logEvent);
    else if ("lostEvents" in row)
        columns = <b>{row.lostEvents}</b>; // TODO
    else
        columns = <></>;

    return <tr key={row.key}>{columns}</tr>;
}

export default function Logs({ rows }: Props) {
    //return <div>{rows.map(e => <div key={e.key}>{JSON.stringify(e)}</div>)}</div>
    return <table className={styles.logs}><tbody>{rows.map(makeRow)}</tbody></table>;
}
