import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import styles from "./App.module.css";

import RenderView from "./RenderView";
import Editor from "./editor/Editor";

const EXAMPLE = `\
repeat 6 {
    circle (w/8 * i + t*w/4) (h/2) 50
    setcolor blue@0.2 fill
    if (eq(mod(i,3), 0)) { newpath }
}
`;

export default function App() {
    const [ source, setSource ] = useState(EXAMPLE);

    const [ fitRender, setFitRender ] = useState(true);

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
                        <Panel className={styles.output}>
                            <div className={styles.settings}>
                                <label> <input
                                    type="checkbox"
                                    checked={fitRender}
                                    onChange={e => setFitRender(e.target.checked)}
                                /> Fit</label>
                            </div>

                            <div
                                className={styles.renderView}
                                data-fit-render={fitRender ? "1" : "0"}
                            >
                                <RenderView source={source} />
                            </div>
                        </Panel>

                        { resizeHandle() }

                        <Panel defaultSize={25}>
                            <div>Log / Metrics</div>
                        </Panel>
                    </PanelGroup>
                </Panel>
            </PanelGroup>
        </div>
    );

}
