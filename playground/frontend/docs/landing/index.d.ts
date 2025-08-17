import "react";

declare module "react" {
    interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> {
        name?: string | undefined;
    }
}
