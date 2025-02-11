import { inflate } from "pako";
import { create } from "zustand";

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

    setSource(source: string, fileName?: string|null): void;
    setCompilerError(e: CompilerError|null): void;

    selectFile(fileName: string|null): void;
    saveNewFile(fileName: string): void;
    deleteFile(fileName: string): void;

    updateSourceFromLocationHash(): void;
}

const ACTIVE_FILE_KEY = "saves/activeFileName";

const CURRENT_PROGRAM_KEY = "main/currentProgram";

const PREFIX_FILE_KEY = "saves/byName/";

function extractCodeFromLocationHash() {
    const zipRaw = /zip=([^&]+)/.exec(location.hash);
    if (zipRaw) {
        history.replaceState(null, "", location.href.split("#")[0]);

        try {
            const zip = decodeURIComponent(zipRaw[1]);

            let stream;
            if ((Uint8Array as any).fromBase64) {
                stream = (Uint8Array as any).fromBase64(zip) as Uint8Array;
            } else {
                stream = Uint8Array.from(atob(zip), c => c.charCodeAt(0));
            }

            const bytes = inflate(stream);
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
    const stored = localStorage.getItem(getStorageKeyForCode(activeFileName));
    if (stored !== null)
        return stored;

    return null;
}

function computeSelectFile(state: CurrentProgram, fileName: string|null): Partial<CurrentProgram> {
    if (fileName !== null && state.fileNames.indexOf(fileName) === -1)
        return {};

    if (fileName !== null)
        localStorage.setItem(ACTIVE_FILE_KEY, fileName);
    else
        localStorage.removeItem(ACTIVE_FILE_KEY);


    return {
        source: loadCode(fileName) ?? "",
        activeFileName: fileName,
        programId: state.programId + 1,
        compilerError: null,
    };
}

const useCurrentProgram = create<CurrentProgram>()((set, get) => {
    let initialActiveFileName: string|null = null;
    let initialSource = extractCodeFromLocationHash();

    if (initialSource === null) {
        initialActiveFileName = localStorage.getItem(ACTIVE_FILE_KEY);
        initialSource = loadCode(initialActiveFileName) ?? "";
    }

    let storageWriteTask: ReturnType<typeof setTimeout>|null = null;

    return {
        programId: 1,
        source: initialSource,
        activeFileName: initialActiveFileName,
        fileNames: loadFileNames(),
        compilerError: null,

        setSource(source: string, fileName?: string|null) {
            set(s => {

                const activeFileName = fileName === undefined ? s.activeFileName : fileName;

                // Debounce writes to localStorage.
                if (storageWriteTask !== null)
                    clearTimeout(storageWriteTask);

                storageWriteTask = setTimeout(
                    () => {
                        storageWriteTask = null;
                        const key = getStorageKeyForCode(activeFileName);
                        localStorage.setItem(key, source);
                    },
                    2000,
                );

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
            set(s => computeSelectFile(s, fileName));
        },

        saveNewFile(fileName: string) {
            set(s => {
                localStorage.setItem(PREFIX_FILE_KEY + fileName, s.source);
                localStorage.setItem(ACTIVE_FILE_KEY, fileName);

                const fileNames = [...s.fileNames, fileName];
                fileNames.sort();

                return {
                    activeFileName: fileName,
                    fileNames,
                };
            });
        },

        deleteFile(fileName: string) {
            localStorage.removeItem(PREFIX_FILE_KEY + fileName);

            set(s => {
                let updated: Partial<CurrentProgram> = {};

                if (s.activeFileName === fileName)
                    updated = computeSelectFile(s, null);

                if (s.fileNames.indexOf(fileName) !== -1)
                    updated.fileNames = s.fileNames.filter(n => n !== fileName);

                return updated;
            });
        },

        updateSourceFromLocationHash() {
            const source = extractCodeFromLocationHash();
            if (source !== null)
                get().setSource(source, null);
        },
    };
});

export default useCurrentProgram;
