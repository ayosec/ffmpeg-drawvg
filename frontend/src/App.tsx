import { inflate } from "pako";
import { useEffect, useRef, useState } from "react";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import styles from "./app.module.css";

import CompilerError from "./vgs/CompilerError";
import Editor from "./editor/Editor";
import Header from "./Header";
import MonitorsPanel from "./monitors/MonitorsPanel";
import OutputPanel from "./output/OutputPanel";

const CURRENT_PROGRAM_STORAGE_KEY = "main/currentProgram";

function extractCodeFromLocationHash() {
    const zipRaw = /zip=([^&]+)/.exec(location.hash);
    if (zipRaw) {
        history.replaceState(null, "", location.href.split("#")[0]);

        try {
            const zip = decodeURIComponent(zipRaw[1]);

            let stream;
            if ((Uint8Array as any).fromBase64) {
                stream = (Uint8Array as any).fromBase64(zip) as Uint8Array;
            } else {
                stream = Uint8Array.from(atob(zip), c => c.charCodeAt(0));
            }

            const bytes = inflate(stream);
            return new TextDecoder().decode(bytes);
        } catch (error) {
            console.log("Unable to load code from URL.", error);
        }
    }

    return null;
}

function loadInitialCode() {
    const code = extractCodeFromLocationHash();
    if (code !== null)
        return code;

    const stored = localStorage.getItem(CURRENT_PROGRAM_STORAGE_KEY);
    if (stored !== null)
        return stored;

    return `\
rect 0 0 w h
setcolor #fefefe
fill

setvar rad (h/8)
setvar count (w/rad+1)
setlinewidth (rad/8)

repeat count {
    setvar hue (360/count*i)
    setvar top (rad*1.5)

    circle (rad*i+rad/2) top rad
    sethsla hue 0.9 0.5 1
    pstroke
    sethsla hue 0.9 0.7 1
    fill

    setvar p (t/1.5-floor(t/1.5))
    sethsla hue 0.9 0.7 (1-p)
    circle (rad*i+rad/2) (top+h*p) (rad-p*rad)
    fill
}`;
}

export default function App() {
    const [ program, setProgram ] = useState(() => ({ id: 0, source: loadInitialCode() }));

    const [ compilerError, setCompilerError ] = useState<CompilerError|null>(null);

    const debounceStorageUpdate = useRef<ReturnType<typeof setTimeout>>(null);

    useEffect(() => {
        const handler = () => {
            const source = extractCodeFromLocationHash();
            if (source !== null)
                setProgram({ id: performance.now(), source });
        };

        window.addEventListener("hashchange", handler);
        return () => window.removeEventListener("hashchange", handler);
    }, []);

    useEffect(() => {
        const cancel = () => {
            if (debounceStorageUpdate.current !== null)
                clearTimeout(debounceStorageUpdate.current);
        };

        cancel();

        debounceStorageUpdate.current = setTimeout(() => {
            debounceStorageUpdate.current = null;
            localStorage.setItem(CURRENT_PROGRAM_STORAGE_KEY, program.source);
        }, 2000);

        return cancel;
    }, [ program ]);

    const ResizeHandle = () => (
        <PanelResizeHandle className={styles.resizeHandle} children={<span />} />
    );

    return (
        <div className={styles.main} >
            <Header />

            <PanelGroup direction="horizontal">
                <Panel>
                    <Editor
                        autoFocus={true}
                        program={program}
                        compilerError={compilerError}
                        setSource={source => {
                            setProgram({ id: program.id + 1, source });
                            setCompilerError(null);
                        }}
                    />
                </Panel>

                <ResizeHandle />

                <Panel>
                    <PanelGroup direction="vertical">
                        <Panel>
                            <OutputPanel program={program} />
                        </Panel>

                        <ResizeHandle />

                        <Panel defaultSize={25}>
                            <MonitorsPanel
                                program={program}
                                setCompilerError={setCompilerError}
                            />
                        </Panel>
                    </PanelGroup>
                </Panel>
            </PanelGroup>
        </div>
    );
}
