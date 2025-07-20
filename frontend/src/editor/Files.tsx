import { useRef, useState } from "react";

import { FaUndo } from "react-icons/fa";
import { HiOutlineTrash } from "react-icons/hi2";
import { IoArchive, IoSave, IoWarning } from "react-icons/io5";

import IconButton from "../base/IconButton";
import ModalWindow from "../base/ModalWindow";
import ZipFile from "../utils/zipfiles";
import useCurrentProgram from "../currentProgram";
import { downloadBlob } from "../utils/blobs";

import styles from "../base/dialog.module.css";

interface Props {
    onClose(): void;
}

interface EntryProps {
    name: string;
    onAccept(): void;
    onDelete(): void;
}

interface LastRemovedFile {
    name: string;
    source: string;
}

enum NewFileAction {
    Init,
    SaveExisting,
    CreateNew,
}

export default function Files({ onClose }: Props) {
    const activeFileName = useCurrentProgram(s => s.activeFileName);
    const fileNames = useCurrentProgram(s => s.fileNames);
    const selectFile = useCurrentProgram(s => s.selectFile);

    const fileAccepted = useRef(false);

    const initialFileName = useRef<string|null|undefined>(undefined);

    const [ newFile, setNewFile ] = useState(fileNames.length === 0);

    const [ newFileName, setNewFileName ] = useState("");

    const [ removeUndoHistory, setRemoveUndoHistory ] = useState<LastRemovedFile[]>([]);

    if (initialFileName.current === undefined) {
        initialFileName.current = useCurrentProgram.getState().activeFileName;
    }

    const newFileAction
        = fileNames.length === 0 ? NewFileAction.Init
        : initialFileName.current === null ? NewFileAction.SaveExisting
        : NewFileAction.CreateNew;

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

    const showNewFile = newFile || newFileAction === NewFileAction.Init;

    return (
        <ModalWindow title="Saved Files" firstFocus="[tabindex]" onClose={closeDialog}>
            { !showNewFile &&
                <>
                    <div className={styles.topBar}>
                        <div>
                            <IconButton
                                Icon={IoSave}
                                label={
                                    newFileAction === NewFileAction.CreateNew
                                        ? "Create a New File"
                                        : "Save Current Script"
                                }
                                onClick={() => {
                                    if (newFileAction == NewFileAction.CreateNew)
                                        useCurrentProgram.getState().setSource("", "");
                                    else if (initialFileName.current !== undefined)
                                        selectFile(initialFileName.current);

                                    setNewFile(true);
                                }}
                            />

                            <IconButton
                                Icon={IoArchive}
                                label="Download as a ZIP Archive"
                                onClick={dowloadZip}
                            />
                        </div>

                        <div>
                            { removeUndoHistory.length > 0 &&
                                <IconButton
                                    Icon={FaUndo}
                                    label="Restore Removed File"
                                    onClick={() => {
                                        const lrf = removeUndoHistory[0];
                                        if (!lrf)
                                            return;

                                        const state = useCurrentProgram.getState();
                                        state.saveNewFile(lrf.name, lrf.source);
                                        state.selectFile(lrf.name);

                                        setRemoveUndoHistory(removeUndoHistory.slice(1));
                                    }}
                                />
                            }
                        </div>
                    </div>

                    <div
                        tabIndex={0}
                        className={styles.fileSavesList}
                        onKeyDown={onKeyDownList}

                    >
                        { fileNames.map(name =>
                            <Entry
                                key={name}
                                name={name}
                                onAccept={acceptFile}
                                onDelete={() => {
                                    const state = useCurrentProgram.getState();

                                    const source = state.getSource(name);
                                    if (source) {
                                        setRemoveUndoHistory([
                                            { name, source },
                                            ...removeUndoHistory,
                                        ]);
                                    }

                                    state.deleteFile(name);
                                }}
                            />)
                        }
                    </div>
                </>
            }

            { showNewFile &&
                <div className={styles.fileSavesNew}>
                    <div className={styles.help}>
                        <SaveFileHelp action={newFileAction} />
                    </div>

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

            <div className={styles.actions}>
                <div>
                    <button className={styles.close} onClick={closeDialog}>
                        { showNewFile ? "Cancel" : "Close" }
                    </button>

                    { activeFileName !== initialFileName.current
                        && !showNewFile
                        && <button onClick={() => acceptFile()}>Open</button>
                    }

                    { showNewFile
                        && <button disabled={newFileName === ""} onClick={saveNewFile}>Save</button>
                    }
                </div>
            </div>
        </ModalWindow>
    );
}

function Entry({ name, onAccept, onDelete }: EntryProps) {
    const activeFileName = useCurrentProgram(s => s.activeFileName);
    const selectFile = useCurrentProgram(s => s.selectFile);

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
                onClick={onDelete}
            />
        </div>
    );
}

function SaveFileHelp({ action }: { action: NewFileAction }) {
    switch (action){
        case NewFileAction.CreateNew:
            return <p>Create a new empty file.</p>;

        case NewFileAction.SaveExisting:
            return <p>Save the current script to a new file.</p>;

        case NewFileAction.Init:
            return <>
                <p>
                    You can store scripts in the{" "}
                    <a href="https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage">
                        <code>localStorage</code>
                    </a>
                    {" "}of your browser.
                </p>

                <p>
                    Your saved files will appear in this dialog window the next time you open it.
                </p>

                <div className={styles.warning}>
                    <div><IoWarning /></div>
                    <p>
                        If you clear your browser data, or if you are using private/incognito mode,
                        the files will be lost.
                    </p>
                </div>
            </>;
    }
}

function dowloadZip() {
    const state = useCurrentProgram.getState();

    const zip = new ZipFile();

    for (const name of state.fileNames) {
        const source = state.getSource(name);
        if (source)
            zip.add(name + ".txt", source);
    }

    const blob = new Blob(zip.toChunks(), { type: "application/zip" });
    downloadBlob(blob, "drawvg-%NOW.zip");
}
