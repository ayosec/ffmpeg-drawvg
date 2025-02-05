import { Response } from "./protocol";
import { deserializeLogEvent } from "@backend/deserializers";

const WASM_MODULE_URL = import.meta.env.BASE_URL + "wasm-backend/play.mjs";

type ResponseSender = (response: Response) => void;

interface FFI {
    logsSend(requestId: number): void;

    memstats(): number;

    programNew(programId: number, source: string): number;

    programFree(id: number): null;

    programRun(
        programId: number,
        width: number,
        height: number,
        varT: number,
        varN: number,
        varDuration: number,
    ): number;
};

class OwnedBuffer {

    constructor(
        private machine: Machine,
        private offset: number,
        private length: number,
    ) {}

    get(): Uint8Array {
        return this.machine.memSlice(this.offset, this.length);
    }

    free() {
        this.machine.free(this.offset);
        this.offset = -1;
    }

}

export class Program {

    constructor(private machine: Machine, private id: number) {}

    run(
        width: number,
        height: number,
        varT: number,
        varN: number,
        varDuration: number,
    ): OwnedBuffer | null {
        const addr = this.machine.ffi.programRun(
            this.id,
            width,
            height,
            varT,
            varN,
            varDuration,
        );

        if (addr === 0)
            return null;

        return new OwnedBuffer(this.machine, addr, width * height * 4);
    }

    free() {
        if (this.id === -1) {
            console.error("Double free.");
            return;
        }

        this.machine.ffi.programFree(this.id);
        this.id = -1;
    }

};

export class Machine {

    ffi: FFI;

    constructor(readonly wasmInstance: any, readonly responseSender: ResponseSender) {
        const N = "number";
        this.ffi = {
            logsSend: wasmInstance.cwrap("backend_logs_send", null, [N]),
            memstats: wasmInstance.cwrap("backend_memstats", N, []),
            programNew: wasmInstance.cwrap("backend_program_new", N, [N, "string"]),
            programFree: wasmInstance.cwrap("backend_program_free", null, [N]),
            programRun: wasmInstance.cwrap("backend_program_run", N, Array(6).fill(N)),
        };
    }

    free(offset: number) {
        this.wasmInstance._free(offset);
    }

    memSlice(offset: number, length: number): Uint8Array {
        return new Uint8Array(this.wasmInstance["HEAPU8"].buffer, offset, length);
    }

    compile(programId: number, source: string): Program | null {
        const id = this.ffi.programNew(programId, source);

        if (id === 0)
            return null;

        return new Program(this, id);
    }

    logsReceive(
        requestId: number,
        eventsOffset: number,
        eventsCount: number,
        bufferOffset: number,
        lostEvents: number,
    ) {
        const heap = this.wasmInstance["HEAPU8"].buffer;

        const getString = (str: { position: number, length: number }) => {
            if (str.length === 0)
                return "";

            return new TextDecoder()
                .decode(new DataView(heap, bufferOffset + str.position, str.length));
        };

        const events = [];

        for (let index = 0; index < eventsCount; index++) {
            const event = deserializeLogEvent(heap, eventsOffset, index);
            events.push({
                programId: event.program_id,
                repeat: event.repeat,
                level: event.level,
                className: getString(event.class_name),
                message: getString(event.message),
                varN: event.var_n,
                varT: event.var_t,
            });
        }

        this.responseSender({ requestId, logs: { lostEvents, events } });
    }

    memStats() {
        const bufOffset = this.ffi.memstats();
        const buffer = new DataView(this.wasmInstance["HEAPU8"].buffer, bufOffset, 8);
        return {
            totalFreeSpace: buffer.getInt32(0, true),
            totalInUseSpace: buffer.getInt32(4, true),
        };
    }
}

export default async function createMachine(responseSender: ResponseSender) {
    const base: any = {};

    const module = await import(/* @vite-ignore */ WASM_MODULE_URL);
    const instance = await module.default(base);

    const machine = new Machine(instance, responseSender);
    base.machine = machine;

    return machine;
}
