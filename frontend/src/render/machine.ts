import { Response } from "./protocol";

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
        sizeLogEvent: number,
        fieldLogEventRepeat: number,
        fieldLogEventLevel: number,
        fieldLogEventClassName: number,
        fieldLogEventMessage: number,
        fieldLogStringPosition: number,
        fieldLogStringLength: number,
    ) {
        const heap = this.wasmInstance["HEAPU8"].buffer;

        const getString = (event: DataView, logStringField: number) => {
            const position = event.getInt32(logStringField + fieldLogStringPosition, true);
            const length = event.getInt32(logStringField + fieldLogStringLength, true);

            if (length === 0)
                return "";

            const bytes = new DataView(heap, bufferOffset + position, length);

            const decoder = new TextDecoder();
            return decoder.decode(bytes);
        };

        const events = [];

        for (let index = 0; index < eventsCount; index++) {
            const eventBytes = new DataView(heap, eventsOffset + index * sizeLogEvent, sizeLogEvent);
            events.push({
                repeat: eventBytes.getInt32(fieldLogEventRepeat, true),
                level: eventBytes.getInt32(fieldLogEventLevel, true),
                className: getString(eventBytes, fieldLogEventClassName),
                message: getString(eventBytes, fieldLogEventMessage),
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
