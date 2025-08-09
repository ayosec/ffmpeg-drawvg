import { useEffect, useRef } from "react";

import styles from "../base/dialog.module.css";

interface Props {
    title: string|React.ReactNode;
    firstFocus?: string;
    children: React.ReactNode;
    onClose(): void;
};

export default function ModalWindow({ title, firstFocus, onClose, children }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (dialog === null)
            return;

        dialog.showModal();
        dialog.querySelector<HTMLElement>(firstFocus ?? "button:last-child")?.focus();
    }, [ firstFocus ]);

    const onClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        // Close <dialog> if user clicks outside the window.
        const ref = dialogRef.current;
        if (ref === null || e.target !== ref)
            return;

        const { x, y, bottom, right } = ref.getBoundingClientRect();
        const { clientX, clientY } = e;
        if (clientX < x || clientX > right || clientY < y || clientY > bottom)
            onClose();
    };

    return (
        <dialog
            ref={dialogRef}
            className={styles.modal}
            onClose={onClose}
            onClick={onClick}
        >
            <div className={styles.mainLayout}>
                <div className={styles.front}>
                    {
                        typeof(title) === "string"
                            ? <h1>{title}</h1>
                            : title
                    }
                </div>

                <div className={styles.content}>
                    {children}
                </div>
            </div>
        </dialog>
    );
}
