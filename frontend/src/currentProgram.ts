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
    setSource(source: string): void;
    setCompilerError(e: CompilerError|null): void;
    updateSourceFromLocationHash(): void;
}

const CURRENT_PROGRAM_STORAGE_KEY = "main/currentProgram";

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

function loadInitialCode() {
    const code = extractCodeFromLocationHash();
    if (code !== null)
        return code;

    const stored = localStorage.getItem(CURRENT_PROGRAM_STORAGE_KEY);
    if (stored !== null)
        return stored;

    return `\
rect 0 0 w h
setcolor #fefefe
fill

setvar rad (h/8)
setvar count (w/rad+1)
setlinewidth (rad/8)

repeat count {
    setvar hue (360/count*i)
    setvar top (rad*1.5)

    circle (rad*i+rad/2) top rad
    sethsla hue 0.9 0.5 1
    pstroke
    sethsla hue 0.9 0.7 1
    fill

    setvar p (t/1.5-floor(t/1.5))
    sethsla hue 0.9 0.7 (1-p)
    circle (rad*i+rad/2) (top+h*p) (rad-p*rad)
    fill
}`;
}

const useCurrentProgram = create<CurrentProgram>()((set, get) => {
    let storageWriteTask: ReturnType<typeof setTimeout>|null = null;

    return {
        programId: 1,
        source: loadInitialCode(),
        compilerError: null,

        setSource(source: string) {
            set(s => ({
                source,
                programId: s.programId + 1,
                compilerError: null,
            }));

            // Debounce writes to localStorage.
            if (storageWriteTask !== null)
                clearTimeout(storageWriteTask);

            storageWriteTask = setTimeout(() => {
                storageWriteTask = null;
                localStorage.setItem(CURRENT_PROGRAM_STORAGE_KEY, source);
            }, 2000);
        },

        setCompilerError(e: CompilerError|null) {
            set(() => ({ compilerError: e }));
        },

        updateSourceFromLocationHash() {
            const source = extractCodeFromLocationHash();
            if (source !== null)
                get().setSource(source);
        },
    };
});

export default useCurrentProgram;
