import { useState } from "react";

import { IoShareSocial } from "react-icons/io5";

import CompilerError from "../vgs/CompilerError";
import Highlights from "./Highlights";
import IconButton from "../IconButton";
import Share from "./Share";
import { Program } from "../render/protocol";

import styles from "./editor.module.css";

interface Props {
    autoFocus?: boolean,
    program: Program,
    compilerError: CompilerError|null;
    setSource(source: string): void;
}

export default function Editor({ autoFocus, program, compilerError, setSource }: Props) {
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

                    { share && <Share source={program.source} onClose={ () => setShare(false) } /> }
                </div>
            </div>

            <div className={styles.code}>
                <Highlights
                    program={program}
                    compilerError={compilerError}
                />

                <textarea
                    value={program.source}
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
