import { useSyncExternalStore } from "react";

export function usePageVisible() {
    return useSyncExternalStore(
        (callback) => {
            document.addEventListener("visibilitychange", callback);
            return () => document.removeEventListener("visibilitychange", callback);
        },
        () => !document.hidden
    );
}
