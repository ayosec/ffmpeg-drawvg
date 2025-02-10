import { useEffect, useRef, useState } from "react";

import IconButton from "../IconButton";
import { HiOutlineTrash } from "react-icons/hi2";

import styles from "../dialog.module.css";

interface Props {
    source: string;
    setSource(source: string): void;
    onClose(): void;
}

const PREFIX_STORAGE_KEY = "saves/byName/";

export default function Saves({ source, setSource, onClose }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    const fileAccepted = useRef(false);

    const [ saves, setSaves ] = useState(() => {
        const saves: string[] = [];

        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (key?.startsWith(PREFIX_STORAGE_KEY)) {
                saves.push(key.slice(PREFIX_STORAGE_KEY.length));
            }
        }

        saves.sort();

        return saves;
    });

    const [ newFile, setNewFile ] = useState(saves.length === 0);

    const [ newFileName, setNewFileName ] = useState("");

    const [ selected, setSelected ] = useState<number|null>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null)
            return;

        dialog.showModal();
        (dialog.querySelector("[tabindex]") as HTMLElement)?.focus();
    }, []);

    // TODO: when a file is open/save-with-new-name, changes on the <textarea>
    //           should also update the associated localStorage item for the file.
    //           - show the filename in the toolbar.

    const resetSelection = () => {
        setSource(source);
        setSelected(null);
    }

    const activateFile = (name: string) => {
        console.log({activateFile: name});

        fileAccepted.current = true;
        onClose();
    };

    const saveNewFile = () => {
        localStorage.setItem(PREFIX_STORAGE_KEY + newFileName, source);
        activateFile(newFileName);
    };

    const removeSave = (name: string) => {
        localStorage.removeItem(PREFIX_STORAGE_KEY + name);
        resetSelection();
        setSaves(saves.filter(s => name !== s));
    };

    const closeDialog = () => {
        // If the dialog is closed without clicking on `Open`,
        // restore the original source before closing.
        if (!fileAccepted.current)
            setSource(source);

        onClose();
    };

    const changeSelection = (index: number) => {
        const name = saves[index];
        const loaded = localStorage.getItem(PREFIX_STORAGE_KEY + name);
        if (loaded) {
            setSelected(index);
            setSource(loaded);
        }
    };

    const Entry = ({name, index}: { name: string, index: number }) => {
        return (
            <div
                data-index={index}
                className={styles.entry + (selected === index ? ` ${styles.selected}` : "")}
                onClick={() => {
                    if (selected === index)
                        resetSelection();
                    else
                        changeSelection(index);
                }}
            >
                <span>{name}</span>

                <IconButton
                    label="Remove"
                    Icon={HiOutlineTrash}
                    onClick={() => removeSave(name)}
                />
            </div>
        );
    };

    const onKeyDownList = (e: React.KeyboardEvent) => {
        if (document.activeElement !== e.currentTarget)
            return;

        switch (e.key) {
            case "ArrowUp":
                changeSelection(
                    (selected === 0 || selected === null
                        ? saves.length
                        : selected
                    ) - 1
                );
                break;

            case "ArrowDown":
                if (selected === null)
                    changeSelection(0);
                else
                    changeSelection((selected + 1) % saves.length );
                break;

            case "Enter":
                if (selected !== null)
                    onClose();

                break;
        }
    };

    const showNewFile = newFile || saves.length === 0;

    return (
        <dialog
            ref={dialogRef}
            className={styles.modal}
            onClose={closeDialog}
        >
            <div className={styles.mainLayout}>
                <div className={styles.front}>
                    <h1>Saves</h1>
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
                                { saves.map((n, i) => <Entry key={n} name={n} index={i} />) }
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
                                { selected !== null ? "Cancel" : "Close" }
                            </button>
                        </div>

                        <div>
                            { !showNewFile &&
                                <button
                                    onClick={() => {
                                        resetSelection();
                                        setNewFile(true);
                                    }}
                                >
                                    New File
                                </button>
                            }

                            { selected !== null &&
                                <button onClick={() => activateFile(saves[selected])}>Open</button>
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

const NewFileHelp = () =>
    <div className={styles.help}>
        <p>
            You can save files in the{" "}
            <a href="https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage">
                <code>localStorage</code>
            </a>
            {" "}of your browser.
        </p>

        <p>
            If you clear your browser data, or if you are using private/incognito mode,
            the saves will be lost.
        </p>

        <p>
            Your saved files will appear in this dialog window.
        </p>
    </div>;
