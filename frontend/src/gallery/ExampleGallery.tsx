import { useEffect, useMemo, useRef, useState } from "react";

import Backend from "../backend";
import ModalWindow from "../base/ModalWindow";
import useAppLayout, { Layout } from "../base/layout";
import useCurrentProgram from "../currentProgram";

import galleryStyles from "./gallery.module.css";
import styles from "../base/dialog.module.css";

import sourceBoxes from "./boxes.vgs?raw";
import sourceCurveTransition from "./curve-transition.vgs?raw";
import sourceFireworks from "./fireworks.vgs?raw";
import sourceLoco from "./loco.vgs?raw";
import sourcePacman from "./pacman.vgs?raw";
import sourceParticles from "./particles.vgs?raw";
import sourceRocket from "./rocket.vgs?raw";
import sourceTargetFocus from "./target-focus.vgs?raw";
import sourceTimingExpressions from "./timing-expressions.vgs?raw";

const EXAMPLES = [
    { name: "Boxes", source: sourceBoxes },
    { name: "Curve Transition", source: sourceCurveTransition },
    { name: "Fireworks", source: sourceFireworks },
    { name: "Loco", source: sourceLoco },
    { name: "Pac-Man", source: sourcePacman },
    { name: "Particles", source: sourceParticles },
    { name: "Rocket", source: sourceRocket },
    { name: "Focus on Target", source: sourceTargetFocus },
    { name: "Timing Expressions", source: sourceTimingExpressions },
] as const;

const ITEMS_PER_ROW = Math.floor(Math.sqrt(EXAMPLES.length));

interface Props {
    onClose(): void;
};

export default function ExampleGallery({ onClose }: Props) {
    const windowRef = useRef<HTMLDivElement>(null);

    const layout = useAppLayout(s => s.layout);

    const previewSize = useMemo(
        () => Math.round(
                window.innerWidth
                    / (layout === Layout.Main ? 3 : 1.5)
                    / ITEMS_PER_ROW
        ),
        [ layout ],
    );

    const renderGroupRef = useRef<RenderGroup|null>(null);

    const [ selectedItem, setSelectedItem ] = useState(0);

    useEffect(() => {
        // Stop workers when dialog is closed.
        return () => {
            if (renderGroupRef.current !== null) {
                renderGroupRef.current.terminate();
                renderGroupRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const win = windowRef.current;

        if (win === null)
            return;

        const selected = win.getElementsByClassName(galleryStyles.selected)[0];
        if (selected instanceof HTMLElement)
            selected.focus();
    }, [ selectedItem ]);


    const renderGroup = () => {
        if (renderGroupRef.current === null)
            renderGroupRef.current = new RenderGroup();

        return renderGroupRef.current;
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        let delta = NaN;

        switch (event.key) {
            case "ArrowUp":
                delta = -ITEMS_PER_ROW;
                break;

            case "ArrowDown":
                delta = ITEMS_PER_ROW;
                break;

            case "ArrowLeft":
                delta = -1;
                break;

            case "ArrowRight":
                delta = 1;
                break;

            case "Enter":
                event.preventDefault();
                openSelection(selectedItem);
                return;
        }

        if (isNaN(delta))
            return;

        event.preventDefault();

        let nextSelection = selectedItem + delta;
        if (nextSelection < 0)
            nextSelection = EXAMPLES.length + nextSelection;
        else if (nextSelection >= EXAMPLES.length)
            nextSelection = nextSelection - EXAMPLES.length;

        setSelectedItem(nextSelection);
    };

    const openSelection = (index: number) => {
        const example = EXAMPLES[index];
        const name = "Example: " + example.name;
        useCurrentProgram.getState().saveNewFile(name, example.source);
        useCurrentProgram.getState().selectFile(name);
        onClose();
    };

    // Create a grid of <canvas> elements to draw the thumbnails.
    let currentRow: React.ReactNode[]|null = null;
    const gridRows: React.ReactNode[] = [];
    for (const [index, example] of EXAMPLES.entries()) {
        if (currentRow === null) {
            currentRow = [];
            gridRows.push(<div key={gridRows.length}>{currentRow}</div>);
        }

        const className = selectedItem === index ? galleryStyles.selected : "";

        currentRow.push(
            <canvas
                ref={(elem) => {
                    renderGroup().preview(elem, example.name, example.source);
                }}
                aria-label={example.name}
                key={index}
                width={previewSize}
                height={previewSize}
                className={className + " " + galleryStyles.preview}
                tabIndex={0}
                onKeyDown={onKeyDown}
                onDoubleClick={() => { openSelection(index); }}
                onFocus={() => {
                    if (selectedItem !== index)
                        setSelectedItem(index);
                }}
            />
        );

        if (currentRow.length >= ITEMS_PER_ROW)
            currentRow = null;
    }

    return (
        <div ref={windowRef}>
            <ModalWindow title={<h1>Examples<br />Gallery</h1>} onClose={onClose}>
                <div className={galleryStyles.preview}>
                    {gridRows}
                </div>

                <div className={styles.actions}>
                    <button className={styles.close} onClick={onClose}>Close</button>
                    <button onClick={() => openSelection(selectedItem)}>Open</button>
                </div>
            </ModalWindow>
        </div>
    );
}

class RenderGroup {
    #backends: Map<string, Backend>;
    #done: WeakSet<HTMLCanvasElement>;

    constructor() {
        this.#backends = new Map();
        this.#done = new WeakSet();
    }

    terminate() {
        for (const backend of this.#backends.values())
            backend.terminate();

        this.#backends.clear();
    }

    preview(canvas: HTMLCanvasElement | null, name: string, source: string) {
        if (canvas === null || this.#done.has(canvas))
            return;

        this.#done.add(canvas);

        const prevBackend = this.#backends.get(name);
        if (prevBackend !== undefined)
            prevBackend.terminate();

        const suffix = [...name.matchAll(/[A-Z]/g)].join("");
        const backend = new Backend("ExampleRenderer" + suffix);

        backend.init(canvas, [ canvas.width, canvas.height ]);
        backend.setProgram(0, source);
        backend.setPlaying(true, 1);

        this.#backends.set(name, backend);
    }
}
