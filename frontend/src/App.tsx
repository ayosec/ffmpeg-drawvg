import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import styles from "./app.module.css";

import Editor from "./editor/Editor";
import Header from "./Header";
import MonitorsPanel from "./monitors/MonitorsPanel";
import OutputPanel from "./output/OutputPanel";

const EXAMPLE = `\
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

export default function App() {
    const [ source, setSource ] = useState(EXAMPLE);

    const resizeHandle = () => (
        <PanelResizeHandle className={styles.resizeHandle} children={<span />} />
    );

    return (
        <div className={styles.main} >
            <Header />
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
                            <MonitorsPanel />
                        </Panel>
                    </PanelGroup>
                </Panel>
            </PanelGroup>
        </div>
    );

}
