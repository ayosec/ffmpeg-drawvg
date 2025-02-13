import deepEqual from "fast-deep-equal";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import widgets from "../base/widgets.module.css";

interface Props<T> {
    title?: string;
    value: T;
    valueLabel: string|number,
    options: [T, string][];
    optionsAlign?: "left" | "right" | "center";
    onChange(value: T): void;
}

interface OptionsProps<T> {
    value: T;
    options: [T, string][];
    optionsAlign?: "left" | "right" | "center";
    onClose(): void;
    onChange(value: T): void;
}

function Options<T>({ value, options, optionsAlign, onClose, onChange }: OptionsProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);

    const [ selected, setSelected ] = useState(
        () => options.findIndex(o => deepEqual(o[0], value))
    );

    useEffect(() => {
        // Move the <div> for the options next to the <button>.
        const ref = containerRef.current;

        if (ref === null)
            return;

        const selector = ref.previousElementSibling;
        if (selector === null)
            return;

        const selectorRect = selector.getBoundingClientRect();
        const optionsRect = ref.getBoundingClientRect();

        if (selectorRect.top + optionsRect.height + 5 < window.innerHeight)
            ref.style.top = selectorRect.top + selectorRect.height + 5 + "px";
        else
            ref.style.top = selectorRect.top - optionsRect.height - 5 + "px";

        if (selectorRect.left + optionsRect.width + 5 < window.innerWidth)
            ref.style.left = selectorRect.left + "px";
        else
            ref.style.left = selectorRect.left + selectorRect.width - optionsRect.width + "px";
    }, []);

    useEffect(() => {
        // Close when the window is resized.
        window.addEventListener("resize", onClose);
        return () => window.removeEventListener("resize", onClose);
    }, [ onClose ]);

    useLayoutEffect(() => {
        // Ensure selected item is focused.
        containerRef
            .current
            ?.querySelector<HTMLButtonElement>(`button:nth-child(${selected + 1})`)
            ?.focus();
    }, [ selected ]);

    useEffect(() => {
        // Close when then focus is lost.
        const onFocus = (event: FocusEvent) => {
            const target: any = event.target;
            if (target?.parentElement !== containerRef.current)
                onClose();
        };

        document.addEventListener("focus", onFocus, true);
        return () => document.removeEventListener("focus", onFocus, true);
    }, [ onClose ]);


    const onKey = (selected: number, value: T, event: KeyboardEvent) => {
        const key = event.key;

        switch (key) {
            case "Enter":
                onChange(value);
                onClose();
                break;

            case "Escape":
                onClose();
                break;

            case "ArrowUp":
                setSelected((selected > 0 ? selected : options.length) - 1);
                break;

            case "Tab":
            case "ArrowDown":
                setSelected((selected + 1) % options.length);
                break;

            default:
                // Don't invoke preventDefault();
                return;
        }

        event.preventDefault();
    };

    const style: React.CSSProperties = { textAlign: optionsAlign };

    return <>
        <div ref={containerRef} role="listbox" className={widgets.selectOptions}>
            {
                options.map((option, i) =>
                    <button
                        key={i}
                        role="option"
                        style={style}
                        onKeyDown={e => onKey(selected, option[0], e.nativeEvent)}
                        className={selected === i ? widgets.selected : undefined}
                        onFocus={() => setSelected(i) }
                        onClick={() => {
                            onChange(option[0]);
                            onClose();
                        }}
                    >{option[1]}</button>
                )
            }
        </div>

        <div aria-hidden="true" className={widgets.selectBackdrop} onClick={onClose} />
    </>;
}

export default function Select<T>(
    { title, value, valueLabel, options, optionsAlign, onChange }: Props<T>
) {
    const [ open, setOpen ] = useState(false);

    const selectRef = useRef<HTMLButtonElement>(null);

    return <>
        <button
            ref={selectRef}
            role="select"
            aria-label={title}
            className={widgets.button + " " + widgets.dropdownArrow}
            onClick={() => setOpen(!open)}
        >
            {valueLabel}
        </button>

        {
            open &&
                <Options
                    value={value}
                    options={options}
                    optionsAlign={optionsAlign}
                    onClose={() => setOpen(false) }
                    onChange={value => {
                        onChange(value);
                        setOpen(false);

                        requestAnimationFrame(() => selectRef.current?.focus());
                    }}
                />
        }
    </>;
}
