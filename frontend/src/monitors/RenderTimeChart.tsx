import { useEffect, useState } from "react";

import SerialNumber from "./serial";
import { RenderTimeChunk } from "../render/protocol";

import styles from "./rendertime.module.css";

interface Props {
    chunks: RenderTimeChunk[];
}

const HEATMAP_COLUMNS = 10;

function columnNumber(n: number) {
    let value;
    if (n > 100)
        value = Math.round(n);
    else if (n > 10)
        value = n.toFixed(1);
    else if (n > 0.01)
        value = n.toFixed(2);
    else
        value = "≈ 0";

    return <td title={`${n} millisecons`}>{value}</td>;
}

const ChunksKeys = {
    cache: new WeakMap<Float32Array, number>(),

    get(chunk: Float32Array): number {
        const existing = this.cache.get(chunk);
        if (existing !== undefined)
            return existing;

        const key = SerialNumber.next();
        this.cache.set(chunk, key);
        return key;
    },
};

function* dataRows(rowSize: number, chunks: RenderTimeChunk[]) {
    let dataRow = [];
    let key = undefined;
    let frame = 0;

    for (const chunk of chunks) {
        if (dataRow.length === 0) {
            key = ChunksKeys.get(chunk.data);
            frame = chunk.startFrame;
        }

        for (const renderTime of chunk.data) {
            frame++;
            dataRow.push(renderTime);

            if (dataRow.length >= rowSize) {
                yield { key: `${key}-${frame}`, dataRow };
                dataRow = [];
            }
        }
    }

    if (dataRow.length > 0)
        yield { key: `${key}-${frame}`, dataRow };
}

function useTableRects() {
    const [ containerRef, setContainerRef ] = useState<HTMLDivElement|null>(null);

    const [ rowHeight, setRowHeight ] = useState(0);
    const [ tableBodyHeight, setTableBodyHeight ] = useState(0);

    useEffect(() => {
        if (containerRef === null)
            return;

        const resizeObserver = new ResizeObserver(() => {
            const tr = containerRef.querySelector("tbody tr");
            if (tr === null)
                return;

            const panelRect = containerRef.getBoundingClientRect();
            const rowRect = tr.getBoundingClientRect();

            setRowHeight(rowRect.height);
            setTableBodyHeight(panelRect.y + panelRect.height - rowRect.y);
        });

        resizeObserver.observe(containerRef);

        return () => resizeObserver.disconnect();
    }, [ containerRef ]);

    return [ rowHeight, tableBodyHeight, setContainerRef ] as const;
}

export default function RenderTimeChart({ chunks }: Props) {
    const [ rowHeight, tableBodyHeight, setContainerRef ] = useTableRects();

    const numRows = Math.max(2, Math.floor(tableBodyHeight / Math.max(1, rowHeight)) - 1);

    const totalData = chunks.reduce((a, c) => c.data.length + a,  0);
    const rowSize = Math.floor(Math.max(totalData / numRows, 5));

    // Process data to determine the data in each row.

    const rows = [];
    let globalMax = -Infinity;
    let globalMin = Infinity;

    for (const { key, dataRow } of dataRows(rowSize, chunks)) {
        let max = -Infinity;
        let min = Infinity;
        let sum = 0;

        for (const n of dataRow) {
            sum += n;
            if (n > max) max = n;
            if (n < min) min = n;
        }

        if (max > globalMax) globalMax = max;
        if (min < globalMin) globalMin = min;

        rows.push({ key, max, min, sum, dataRow });
    }

    // Build the elements.

    let frame = 0;
    const tbody = rows.map(row => {
        const frames = `${frame} - ${frame + row.dataRow.length}`;
        frame += row.dataRow.length;

        return (
            <tr key={row.key}>
                <td>{frames}</td>
                {columnNumber(row.min)}
                {columnNumber(row.max)}
                {columnNumber(row.sum / row.dataRow.length)}
            </tr>
        );
    });

    return (
        <div ref={setContainerRef} className={styles.renderTime}>
            <table className={styles.dataRows}>
                <thead>
                    <tr>
                        <th>Frames</th>
                        <th>Min.</th>
                        <th>Max.</th>
                        <th>Avg.</th>
                        <th>{" "}</th>
                    </tr>
                </thead>
                <tbody>{tbody}</tbody>
            </table>
        </div>
    );

}
