import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import styles from "./App.module.css";

import Editor from "./editor/Editor";
import LogsPanel from "./LogsPanel";
import OutputPanel from "./output/OutputPanel";

const EXAMPLE = `\
//setcolor #eeeeee
//rect 0 0 (w) (h)
//fill
//newpath
//
//repeat 4 {
//    circle (w/8 * i + (1+sin(t))*w/4) (h/2) 50
//    setcolor blue@0.2 fill
//    if (eq(mod(i,3), 0)) { newpath }
//}

setvar a (mod(n,180)/180)
setvar b (mod(t,3)/3)
M 0 (h-h*a) L (w) (h*b)
setlinewidth 5
stroke
`;

export default function App() {
    const [ source, setSource ] = useState(EXAMPLE);

    const resizeHandle = () => <PanelResizeHandle className={styles.resizeHandle} />;

    return (
        <div className={styles.main} >
            <header>Playground</header>
            <PanelGroup direction="horizontal">
                <Panel>
                    <Editor autoFocus={true} source={source} setSource={setSource} />
                </Panel>

                { resizeHandle() }

                <Panel>
                    <PanelGroup direction="vertical">
                        <Panel>
                            <OutputPanel source={source} />
                        </Panel>

                        { resizeHandle() }

                        <Panel defaultSize={25}>
                            <LogsPanel />
                        </Panel>
                    </PanelGroup>
                </Panel>
            </PanelGroup>
        </div>
    );

}
