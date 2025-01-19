export interface StateChange {
    playing?: boolean;
    size?: [number, number];
    source?: string;
}

export type Action
    = "GetLogs"
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

export type Response
    = { init: "ok"; }
    | { requestId: number; failure: string; }
    | { requestId: number; logs: LogsData; }
    ;
