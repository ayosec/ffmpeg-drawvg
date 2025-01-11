import { useState } from "react";
import styles from "./App.module.css";
import RenderView from "./RenderView";

const EXAMPLE = `\
repeat 6 {
    circle (w/8 * i + t*w) (h/2) 50
    setcolor blue@0.2 fill
    if (eq(mod(i,3), 0)) { newpath }
}
`;

export default function App() {
    const [ source, setSource ] = useState(EXAMPLE);

    return (
        <div className={styles.editor}>
            <header>Playground</header>

            <textarea
                value={source}
                onChange={e => setSource(e.target.value)}
            />
            <RenderView source={source} />
        </div>
    )

}
