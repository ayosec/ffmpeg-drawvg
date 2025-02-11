import { useEffect } from "react";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import Editor from "./editor/Editor";
import Header from "./Header";
import MonitorsPanel from "./monitors/MonitorsPanel";
import OutputPanel from "./output/OutputPanel";
import useCurrentProgram from "./currentProgram";

import styles from "./app.module.css";

export default function App() {
    const updateSourceFromLocationHash = useCurrentProgram(s => s.updateSourceFromLocationHash);

    useEffect(() => {
        const handler = () => { updateSourceFromLocationHash(); };

        window.addEventListener("hashchange", handler);
        return () => window.removeEventListener("hashchange", handler);
    }, [ updateSourceFromLocationHash ]);

    const ResizeHandle = () => (
        <PanelResizeHandle className={styles.resizeHandle} children={<span />} />
    );

    return (
        <div className={styles.main} >
            <Header />

            <PanelGroup direction="horizontal">
                <Panel>
                    <Editor autoFocus={true} />
                </Panel>

                <ResizeHandle />

                <Panel>
                    <PanelGroup direction="vertical">
                        <Panel>
                            <OutputPanel />
                        </Panel>

                        <ResizeHandle />

                        <Panel defaultSize={25}>
                            <MonitorsPanel />
                        </Panel>
                    </PanelGroup>
                </Panel>
            </PanelGroup>
        </div>
    );
}
