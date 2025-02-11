import { useEffect, useRef, useState } from "react";

import IconButton from "../base/IconButton";
import useCurrentProgram from "../currentProgram";
import { HiOutlineTrash } from "react-icons/hi2";

import styles from "../base/dialog.module.css";

interface Props {
    onClose(): void;
}

export default function Files({ onClose }: Props) {
    const activeFileName = useCurrentProgram(s => s.activeFileName);
    const fileNames = useCurrentProgram(s => s.fileNames);
    const selectFile = useCurrentProgram(s => s.selectFile);

    const dialogRef = useRef<HTMLDialogElement>(null);

    const fileAccepted = useRef(false);

    const initialFileName = useRef<string|null|undefined>(undefined);

    const [ newFile, setNewFile ] = useState(fileNames.length === 0);

    const [ newFileName, setNewFileName ] = useState("");

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null)
            return;

        dialog.showModal();
        (dialog.querySelector("[tabindex]") as HTMLElement)?.focus();
    }, []);

    if (initialFileName.current === undefined) {
        initialFileName.current = useCurrentProgram.getState().activeFileName;
    }

    const acceptFile = () => {
        fileAccepted.current = true;
        onClose();
    };

    const saveNewFile = () => {
        useCurrentProgram.getState().saveNewFile(newFileName);
        fileAccepted.current = true;
        onClose();
    };

    const closeDialog = () => {
        // If the dialog is closed without clicking on `Open`,
        // restore the original source before closing.
        if (!fileAccepted.current && initialFileName.current !== undefined)
            selectFile(initialFileName.current);

        onClose();
    };

    const onKeyDownList = (e: React.KeyboardEvent) => {
        if (document.activeElement !== e.currentTarget)
            return;

        const moveSelection = (offset: number) => {
            let toSelect = fileNames.indexOf(activeFileName ?? "\0") + offset;
            if (toSelect < 0)
                toSelect = fileNames.length - 1;
            else if (toSelect >= fileNames.length)
                toSelect = 0;

            selectFile(fileNames[toSelect]);
        };

        switch (e.key) {
            case "ArrowUp":
                moveSelection(-1);
                break;

            case "ArrowDown":
                moveSelection(1);
                break;

            case "Enter":
                if (activeFileName !== null)
                    acceptFile();
                break;
        }
    };

    const showNewFile = newFile || fileNames.length === 0;

    return (
        <dialog
            ref={dialogRef}
            className={styles.modal}
            onClose={closeDialog}
        >
            <div className={styles.mainLayout}>
                <div className={styles.front}>
                    <h1>Files</h1>
                </div>

                <div className={styles.content}>
                    { !showNewFile &&
                        <>
                            <p>
                                Open an existing file, or save the current one.
                            </p>

                            <div
                                tabIndex={0}
                                className={styles.fileSavesList}
                                onKeyDown={onKeyDownList}

                            >
                                { fileNames.map(n =>
                                    <Entry key={n} name={n} onAccept={acceptFile} />)
                                }
                            </div>
                        </>
                    }

                    { showNewFile &&
                        <div className={styles.fileSavesNew}>
                            <NewFileHelp />

                            <input
                                type="text"
                                tabIndex={0}
                                autoFocus={true}
                                placeholder="Name"
                                value={newFileName}
                                onChange={e => setNewFileName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key == "Enter" && newFileName !== "")
                                        saveNewFile();
                                }}
                            />
                        </div>
                    }

                    <div className={styles.actions + " " + styles.multiGroups}>
                        <div>
                            <button className={styles.close} onClick={closeDialog}>
                                Close
                            </button>
                        </div>

                        <div>
                            { !showNewFile &&
                                <button
                                    onClick={() => {
                                        if (initialFileName.current !== undefined) {
                                            selectFile(initialFileName.current);
                                            setNewFile(true);
                                        }
                                    }}
                                >
                                    New File
                                </button>
                            }

                            { activeFileName !== initialFileName.current &&
                                <button onClick={() => acceptFile()}>Open</button>
                            }

                            { showNewFile &&
                                <button disabled={newFileName === ""} onClick={saveNewFile}>Save</button>
                            }
                        </div>
                    </div>
                </div>
            </div>

        </dialog>
    );
}

function Entry({ name, onAccept }: { name: string, onAccept(): void, }) {
    const activeFileName = useCurrentProgram(s => s.activeFileName);
    const selectFile = useCurrentProgram(s => s.selectFile);

    const deleteFile = (name: string) => {
        useCurrentProgram.getState().deleteFile(name);
    };

    const active = activeFileName === name;

    return (
        <div
            className={styles.entry + (active ? ` ${styles.selected}` : "")}
            onClick={() => {
                selectFile(active ? null : name);
            }}
            onDoubleClick={() => {
                selectFile(name);
                onAccept();
            }}
        >
            <span>{name}</span>

            <IconButton
                label="Remove"
                Icon={HiOutlineTrash}
                onClick={() => deleteFile(name)}
            />
        </div>
    );
}

const NewFileHelp = () => (
    <div className={styles.help}>
        <p>
            You can store scripts in the{" "}
            <a href="https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage">
                <code>localStorage</code>
            </a>
            {" "}of your browser.
        </p>

        <p>
            If you clear your browser data, or if you are using private/incognito mode,
            the files will be lost.
        </p>

        <p>
            Your saved files will appear in this dialog window.
        </p>
    </div>
);
