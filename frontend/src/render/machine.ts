import { Response } from "./protocol";
import { deserializeLogEvent } from "@backend/deserializers";

const WASM_MODULE_URL = import.meta.env.BASE_URL + "wasm-backend/play.mjs";

type ResponseSender = (response: Response) => void;

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
    ): number;

    logsSend(requestId: number): void;
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
        reportMemStats: boolean,
        width: number,
        height: number,
        varT: number,
        varN: number,
        varDuration: number,
    ): OwnedBuffer | null {
        const addr = this.machine.ffi.programRun(
            this.id,
            reportMemStats ? 1 : 0,
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
            programNew: wasmInstance.cwrap("backend_program_new", N, ["string"]),
            programFree: wasmInstance.cwrap("backend_program_free", null, [N]),
            programRun: wasmInstance.cwrap("backend_program_run", N, Array(6).fill(N)),
            logsSend: wasmInstance.cwrap("backend_logs_send", null, [N]),
        };
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
                repeat: event.repeat,
                level: event.level,
                className: getString(event.class_name),
                message: getString(event.message),
            });
        }

        this.responseSender({ requestId, logs: { lostEvents, events } });
    }
}

export default async function createMachine(responseSender: ResponseSender) {
    const base: any = {};

    const module = await import(WASM_MODULE_URL);
    const instance = await module.default(base);

    const machine = new Machine(instance, responseSender);
    base.machine = machine;

    return machine;
}
