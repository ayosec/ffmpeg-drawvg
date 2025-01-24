export interface StateChange {
    playing?: boolean;
    visibility?: boolean;
    size?: [number, number];
    source?: string;
}

export type Action
    = "GetLogs"
    | "GetResourceUsage"
    | "NextFrame"
    | "PreviousFrame"
    | "ResetPlayback"
    ;

export type Request
    = { request: "init" }
    | { request: "register", canvas: OffscreenCanvas }
    | { request: "state", change: StateChange }
    | { request: "action", requestId: number, action: Action }
    ;


export interface LogEvent {
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


export interface RenderTime {
    max: number;
    min: number;
    sum: number;
    frameStart: number;
    frameCount: number;
}

export interface MemoryUsage {
    totalFreeSpace: number;
    totalInUseSpace: number;
}

export interface ResourceUsage {
    renderTime?: RenderTime;
    memoryUsage?: MemoryUsage;
}

export type Response
    = { init: "ok"; }
    | { requestId: number; failure: string; }
    | { requestId: number; logs: LogsData; }
    | { requestId: number; resourceUsage: ResourceUsage; }
    ;
