import { inflate } from "pako";
import { create } from "zustand";

import base64 from "./utils/base64";

export interface CompilerError {
    programId: number;
    line: number;
    column: number;
    token: string;
    message: string;
}

interface CurrentProgram {
    programId: number;
    source: string;
    compilerError: CompilerError|null;

    activeFileName: string|null;
    fileNames: string[];

    getSource(fileName?: string|null): string|null;

    setSource(source: string, fileName?: string|null): void;
    setCompilerError(e: CompilerError|null): void;

    selectFile(fileName: string|null): void;
    saveNewFile(fileName: string, source?: string): void;
    deleteFile(fileName: string): void;

    updateSourceFromLocationHash(): void;
}

const ACTIVE_FILE_KEY = "saves/activeFileName";

const CURRENT_PROGRAM_KEY = "main/currentProgram";

const PREFIX_FILE_KEY = "saves/byName/";

function extractCodeFromLocationHash() {
    const zipRaw = /gzip=([^&]+)/.exec(location.hash);
    if (zipRaw) {
        history.replaceState(null, "", location.href.split("#")[0]);

        try {
            const zip = decodeURIComponent(zipRaw[1]);
            const bytes = inflate(base64.decode(zip));
            return new TextDecoder().decode(bytes);
        } catch (error) {
            console.log("Unable to load code from URL.", error);
        }
    }

    return null;
}

function loadFileNames() {
    const saves: string[] = [];

    for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key?.startsWith(PREFIX_FILE_KEY)) {
            saves.push(key.slice(PREFIX_FILE_KEY.length));
        }
    }

    saves.sort();

    return saves;
}

function getStorageKeyForCode(activeFileName: string|null) {
    if (activeFileName === null)
        return CURRENT_PROGRAM_KEY;
    else
        return PREFIX_FILE_KEY + activeFileName;
}

function loadCode(activeFileName: string|null) {
    return localStorage.getItem(getStorageKeyForCode(activeFileName));
}

function loadInitialSource() {
    let activeFileName: string|null = null;
    let source = extractCodeFromLocationHash();

    if (source === null) {
        activeFileName = localStorage.getItem(ACTIVE_FILE_KEY);
        source = loadCode(activeFileName) ?? "";
    }

    return {
        source,
        activeFileName,
    };
}

const useCurrentProgram = create<CurrentProgram>()((set, get) => {
    const storageWriteTask = {
        id: <ReturnType<typeof setTimeout>|null>null,
        fileName: <string|null>null,
    };

    return {
        ...loadInitialSource(),
        programId: 1,
        fileNames: loadFileNames(),
        compilerError: null,

        getSource(fileName: string|null) {
            return loadCode(fileName);
        },

        setSource(source: string, fileName?: string|null) {
            set(s => {
                const activeFileName = fileName === undefined ? s.activeFileName : fileName;

                // Debounce writes to localStorage.
                if (storageWriteTask.id !== null
                    && storageWriteTask.fileName === activeFileName
                ) {
                    clearTimeout(storageWriteTask.id);
                }

                // Store the file only if the name is not empty.
                if (activeFileName !== "") {
                    storageWriteTask.fileName = activeFileName;
                    storageWriteTask.id = setTimeout(
                        () => {
                            storageWriteTask.id = null;

                            const key = getStorageKeyForCode(activeFileName);
                            localStorage.setItem(key, source);
                        },
                        2000,
                    );
                }

                return {
                    source,
                    activeFileName,
                    programId: s.programId + 1,
                    compilerError: null,
                };
            });
        },

        setCompilerError(e: CompilerError|null) {
            set(() => ({ compilerError: e }));
        },

        selectFile(fileName: string|null) {
            set(s => {
                if (fileName !== null && s.fileNames.indexOf(fileName) === -1)
                    return {};

                if (fileName !== null)
                    localStorage.setItem(ACTIVE_FILE_KEY, fileName);
                else
                    localStorage.removeItem(ACTIVE_FILE_KEY);

                return {
                    source: loadCode(fileName) ?? "",
                    activeFileName: fileName,
                    programId: s.programId + 1,
                    compilerError: null,
                };
            });
        },

        saveNewFile(fileName: string, source?: string) {
            set(s => {
                localStorage.setItem(PREFIX_FILE_KEY + fileName, source ?? s.source);
                localStorage.setItem(ACTIVE_FILE_KEY, fileName);

                let fileNames = s.fileNames;

                if (fileNames.indexOf(fileName) === -1) {
                    fileNames = [...s.fileNames, fileName];
                    fileNames.sort();
                }

                return {
                    activeFileName: fileName,
                    fileNames,
                };
            });
        },

        deleteFile(fileName: string) {
            localStorage.removeItem(PREFIX_FILE_KEY + fileName);

            const state = get();

            if (state.activeFileName === fileName)
                state.selectFile(null);

            if (state.fileNames.indexOf(fileName) !== -1)
                set(s => ({ fileNames: s.fileNames.filter(n => n !== fileName) }));
        },

        updateSourceFromLocationHash() {
            const source = extractCodeFromLocationHash();
            if (source !== null)
                get().setSource(source, null);
        },
    };
});

export default useCurrentProgram;
