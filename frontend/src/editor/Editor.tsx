import { useState } from "react";

import { IoShareSocial } from "react-icons/io5";

import Highlights from "./Highlights";
import IconButton from "../IconButton";
import Share from "./Share";
import styles from "./editor.module.css";

interface Props {
    autoFocus?: boolean,
    source: string,
    setSource(source: string): void;
}

export default function Editor({ autoFocus, source, setSource }: Props) {
    const [ share, setShare ] = useState(false);

    return (
        <div className={styles.editor}>
            <div className={styles.toolbar}>
                <div>
                    <IconButton
                        icon={IoShareSocial}
                        label="Share"
                        onClick={() => setShare(true) }
                    />

                    { share && <Share source={source} onClose={ () => setShare(false) } /> }
                </div>
            </div>

            <div className={styles.code}>
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
        </div>
    );

}
