import { useEffect, useState } from "react";

import SerialNumber from "./serial";
import { RenderTimeChunk } from "../render/protocol";

import styles from "./rendertime.module.css";

interface Props {
    chunks: RenderTimeChunk[];
}

function formatNumber(n: number) {
    if (n > 100)
        return Math.round(n);
    else if (n > 10)
        return n.toFixed(1);
    else if (n > 0.1)
        return n.toFixed(2);
    else
        return "< 0.1";
}

function columnNumber(n: number) {
    const value = formatNumber(n);
    return <td aria-label={`${n.toFixed(4)} millisecons`}>{value}</td>;
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

function HeatMapTimesHeader({ max, min, columns }: { max: number, min: number, columns: number }) {
    const headersCount = Math.floor(columns / 5);

    const headers = [
        <span key="start">{formatNumber(min)} ms</span>,
    ];

    const step = (max - min) / (headersCount + 1);

    for (let index = 1; index <= headersCount; index++) {
        const value = min + step * index;
        headers.push(<span key={index}>{value.toFixed(1)}</span>);
    }

    headers.push(<span key="end">{formatNumber(max)} ms</span>);

    return (
        <div className={styles.fullRange} aria-label="Render time">
            {headers}
        </div>
    );
}

function* dataRows(rowSize: number, chunks: RenderTimeChunk[]) {
    // To produce the expected number of rows we have to consider the
    // fractional part of `rowSize` (i.e. we cannot round its value).
    //
    // For example, if `rowSize` is `56.7`, some rows will have `56`
    // items, and other rows will have `57`.

    let nextFullRow = rowSize;
    let totalFrames = 0;

    let dataRow = [];
    let key = undefined;

    for (const chunk of chunks) {
        if (dataRow.length === 0)
            key = ChunksKeys.get(chunk.data);

        for (const renderTime of chunk.data) {
            totalFrames++;
            dataRow.push(renderTime);

            if (totalFrames >= nextFullRow) {
                yield { key: `${key}-${totalFrames}`, dataRow };

                nextFullRow += rowSize;
                dataRow = [];
            }
        }
    }

    if (dataRow.length > 0)
        yield { key: `${key}-${totalFrames}`, dataRow };
}

function useTableRects() {
    const [ containerRef, setContainerRef ] = useState<HTMLDivElement|null>(null);

    const [ sizes, setSizes ] = useState({ row: 0, tbody: 0, heatMapColumns: 10 });

    useEffect(() => {
        if (containerRef === null)
            return;

        const resizeObserver = new ResizeObserver(() => {
            const tr = containerRef.querySelector("tbody tr");
            if (tr === null)
                return;

            const panelRect = containerRef.getBoundingClientRect();
            const rowRect = tr.getBoundingClientRect();
            const firstColumn = tr.querySelector("td")!.getBoundingClientRect();

            setSizes({
                row: rowRect.height,
                tbody: panelRect.y + panelRect.height - rowRect.y,
                heatMapColumns: Math.max(5, Math.floor(rowRect.width / firstColumn.width)),
            });
        });

        resizeObserver.observe(containerRef);

        return () => resizeObserver.disconnect();
    }, [ containerRef ]);

    return [ sizes, setContainerRef ] as const;
}

function onMouseEnterTimeRange(event: React.MouseEvent) {
    const dataRef = event.target;

    if (!(dataRef instanceof HTMLSpanElement))
        return;

    const info = dataRef.closest("table")?.querySelector(`div.${styles.activeColumn}`);

    if (!(info instanceof HTMLDivElement))
        return;

    const span = info.querySelector("span")!;
    span.innerText = dataRef.dataset.timeRange ?? "";
    const textWidth = span.getBoundingClientRect().width;

    // Align the header with the header.
    const dataRect = dataRef.getBoundingClientRect();
    const containerRect = info.parentElement?.getBoundingClientRect();

    if (containerRect === undefined)
        return;

    const left = Math.min(
        Math.max(0, dataRect.x - containerRect.x + (dataRect.width - textWidth) / 2),
        (containerRect.width - textWidth) - 10,
    );

    info.style.marginLeft = `${left}px`;
}

export default function RenderTimeChart({ chunks }: Props) {
    const [ sizes, setContainerRef ] = useTableRects();

    const numRows = Math.max(2, Math.floor(sizes.tbody / Math.max(1, sizes.row)));

    const totalNumberOfFrames = chunks.reduce((a, c) => c.data.length + a,  0);
    const rowSize = Math.max(totalNumberOfFrames / numRows, 5);

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

    const globalRange = globalMax - globalMin + 0.01;
    const heatMapStep = globalRange / sizes.heatMapColumns;

    let frame = 0;
    const tbody = rows.map(row => {
        const currentFrame = frame;
        frame += row.dataRow.length + 1;

        const heat = Array(sizes.heatMapColumns).fill(0);

        for (const item of row.dataRow)
            heat[Math.floor((item - globalMin) / heatMapStep)] += 1;

        const drMax = Math.max(...heat);

        let columnTime = globalMin;

        const cells = heat.map((item, index) => {
            const currentColumnTime = columnTime;
            columnTime += heatMapStep;

            const intensity = 100 * item / drMax;
            const style = {
                backgroundColor: `
                    color-mix(
                        in oklab,
                        var(--heatmap-hot) ${intensity}%,
                        var(--heatmap-cold) ${100 - intensity}%
                    )`,
            };

            return (
                <span
                    key={index}
                    style={item > 0 ? style : {}}
                    onMouseEnter={onMouseEnterTimeRange}
                    data-time-range={`${currentColumnTime.toFixed(1)} - ${columnTime.toFixed(1)}`}
                    data-items={item > 0 ? item : undefined}
                ></span>
            );
        });

        const grid = <div>{cells}</div>;

        return (
            <tr key={row.key}>
                <td aria-label={`Frames range (${currentFrame} - ${frame - 1})`}>{currentFrame}</td>
                {columnNumber(row.min)}
                {columnNumber(row.sum / row.dataRow.length)}
                {columnNumber(row.max)}
                <td className={styles.heatGrid}>{grid}</td>
            </tr>
        );
    });

    return (
        <div ref={setContainerRef} className={styles.renderTime}>
            <table className={styles.dataRows}>
                <thead>
                    <tr>
                        <th aria-label="Number of frames">
                            <span className={styles.frameCount}>
                                {totalNumberOfFrames}
                            </span>
                        </th>
                        <th>Min.</th>
                        <th>Avg.</th>
                        <th>Max.</th>
                        <th className={styles.heatMapRange}>
                            <HeatMapTimesHeader
                                min={globalMin}
                                max={globalMax}
                                columns={sizes.heatMapColumns}
                            />

                            <div className={styles.activeColumn}><span></span></div>
                        </th>
                    </tr>
                </thead>
                <tbody>{tbody}</tbody>
            </table>
        </div>
    );
}
