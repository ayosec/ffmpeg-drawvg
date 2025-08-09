export interface StateChange {
    playing?: boolean;
    speed?: number;
    visibility?: boolean;
    size?: [number, number];
    program?: Program;
}

export interface Program {
    id: number;
    source: string;
}

export interface VideoParams {
    source: string;
    frames: number;
    encoderConfig: VideoEncoderConfig;
}

export type Action
    = "DumpMemoryStats"
    | "GetLogs"
    | "GetResourceUsage"
    | "NextFrame"
    | "Ping"
    | "PreviousFrame"
    | "ResetPlayback"
    ;

export type Request
    = { request: "init" }
    | { request: "register", canvas: OffscreenCanvas, size: [ number, number ] }
    | { request: "state", change: StateChange }
    | { request: "action", requestId: number, action: Action }
    | { request: "video", params: VideoParams }
    ;


export interface LogEvent {
    programId: number;
    repeat: number;
    level: number;
    className: string;
    message: string;
    varN: number;
    varT: number;
}

export interface LogsData {
    lostEvents: number;
    events: LogEvent[];
}


export interface RenderTimeChunk {
    uniqueId: number;
    startFrame: number;
    data: Float32Array;
}

export interface ResourceUsage {
    renderTimeChunk?: RenderTimeChunk;
}

export type Response
    = { init: "ok"; }
    | { requestId: number; failure: string; }
    | { requestId: number; logs: LogsData; }
    | { requestId: number; resourceUsage: ResourceUsage; }
    | { requestId: number; pong: true }
    | { videoProgress: { frames: number } }
    | { videoFinish: { buffer: ArrayBuffer } }
    | { videoError: { error: string } }
    ;
