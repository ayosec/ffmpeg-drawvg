const WASM_MODULE_URL = import.meta.env.BASE_URL + "wasm-backend/play.mjs"

interface FFI {
    programNew(source: string): number;

    programFree(id: number): null;

    programRun(
        programId: number,
        reportMemStats: number,
        width: number,
        height: number,
        varT: number,
        varN: number,
        varDuration: number,
    ): number
};

function memTracker(memInfo: any) {
    console.log(memInfo);
}

class OwnedBuffer {

    constructor(
        private backend: Backend,
        private offset: number,
        private length: number,
    ) {}

    get(): Uint8Array {
        return this.backend.memSlice(this.offset, this.length);
    }

    free() {
        this.backend.free(this.offset);
        this.offset = -1;
    }

}

export class Program {

    constructor(private backend: Backend, private id: number) {}

    run(
        reportMemStats: boolean,
        width: number,
        height: number,
        varT: number,
        varN: number,
        varDuration: number,
    ): OwnedBuffer | null {
        const addr = this.backend.ffi.programRun(
            this.id,
            reportMemStats ? 1 : 0,
            width,
            height,
            varT,
            varN,
            varDuration,
        )

        if (addr === 0)
            return null;

        return new OwnedBuffer(this.backend, addr, width * height * 4);
    }

    free() {
        if (this.id === -1) {
            console.error("Double free.");
            return;
        }

        this.backend.ffi.programFree(this.id);
        this.id = -1;
    }

};

export class Backend {

    ffi: FFI;

    constructor(readonly wasmInstance: any) {
        const N = "number";
        this.ffi = {
            programNew: wasmInstance.cwrap("backend_program_new", N, ["string"]),
            programFree: wasmInstance.cwrap("backend_program_free", null, [N]),
            programRun: wasmInstance.cwrap("backend_program_run", N, Array(6).fill(N)),
        }
    }

    free(offset: number) {
        this.wasmInstance._free(offset);
    }

    memSlice(offset: number, length: number): Uint8Array {
        return new Uint8Array(this.wasmInstance["HEAPU8"].buffer, offset, length);
    }

    compile(source: string): Program | null {
        const id = this.ffi.programNew(source);

        if (id === 0)
            return null

        return new Program(this, id);
    }

}

export default async function createBackend() {
    const module = await import(WASM_MODULE_URL);
    const instance = await module.default({ memTracker });
    return new Backend(instance);
}
