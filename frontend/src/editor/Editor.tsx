import styles from "./Editor.module.css";
import Highlights from "./Highlights";

interface Props {
    autoFocus?: boolean,
    source: string,
    setSource(source: string): void;
}

export default function Editor({ autoFocus, source, setSource }: Props) {

    return (
        <div className={styles.editor}>
            <Highlights source={source} />

            <textarea
                value={source}
                autoFocus={autoFocus}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                onChange={e => setSource(e.target.value)}
            />
        </div>
    );

}
