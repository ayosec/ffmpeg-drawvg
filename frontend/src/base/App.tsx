import { useEffect } from "react";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import Editor from "../editor/Editor";
import Header from "./Header";
import MonitorsPanel from "../monitors/MonitorsPanel";
import OutputPanel from "../output/OutputPanel";
import WelcomeBox from "./WelcomeBox";
import useAppLayout from "./layout";
import useCurrentProgram from "../currentProgram";

import styles from "./app.module.css";

enum Layout {
    Main = 0,
    Vertical = 1,
}

export default function App() {
    const updateSourceFromLocationHash = useCurrentProgram(s => s.updateSourceFromLocationHash);

    const layout = useAppLayout(s => s.layout);

    useEffect(() => {
        const handler = () => { updateSourceFromLocationHash(); };

        window.addEventListener("hashchange", handler);
        return () => window.removeEventListener("hashchange", handler);
    }, [ updateSourceFromLocationHash ]);

    const ResizeHandle = () => (
        <PanelResizeHandle className={styles.resizeHandle} children={<span />} />
    );

    let app;
    let layoutName;
    if (layout == Layout.Main) {
        layoutName = "main";

        app = (
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
        );
    } else {
        layoutName = "vertical";

        app = (
            <div className={styles.verticalContent}>
                <Editor autoFocus={true} />
                <MonitorsPanel renderOutput={true} />
            </div>
        );
    }

    return <>
        <div className={styles.main} data-layout={layoutName}>
            <Header />

            {app}
        </div>

        <WelcomeBox />
    </>;
}
