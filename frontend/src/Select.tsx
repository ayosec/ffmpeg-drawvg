import deepEqual from "fast-deep-equal";
import { useLayoutEffect, useRef, useState } from "react";

import widgets from "./widgets.module.css";

interface Props<T> {
    title?: string;
    value: T;
    valueLabel: string|number,
    options: [T, string][];
    onChange: (value: T) => void;
}

export default function Select<T>({ title, value, valueLabel, options, onChange }: Props<T>) {
    const [ open, setOpen ] = useState(false);
    const [ selected, setSelected ] = useState(value);

    const selectRef = useRef<HTMLButtonElement>(null);
    const optionsRef = useRef<HTMLSelectElement>(null);

    const change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const index = parseFloat(e.target.value);
        setSelected(options[index][0]);
    };

    const acceptSelection = () => {
        onChange(selected);
        setOpen(false);
    };

    const closeAfterBlur = (e: React.FocusEvent) => {
        if(
            optionsRef.current !== null
                && !Object.is(selectRef.current, e.relatedTarget)
                && !Object.is(optionsRef.current, e.relatedTarget)
        ) {
            setOpen(false);
        }
    };

    useLayoutEffect(() => {
        const s = selectRef.current;
        const o = optionsRef.current;

        if (!open || s === null || o === null)
            return;

        const selectRect = s.getBoundingClientRect();
        const optionsRect = o.getBoundingClientRect();

        o.style.top = `${selectRect.y + selectRect.height}px`;

        const alignToRight = selectRect.x + optionsRect.width < window.innerWidth;

        const left = alignToRight
            ? selectRect.x
            : selectRect.x + selectRect.width - optionsRect.width;

        o.style.left = `${left}px`;
        o.dataset.align = alignToRight ? "to-right" : "to-left";
    }, [ open ]);

    return <>
        <button
            ref={selectRef}
            aria-label={title}
            className={widgets.button + " " + widgets.dropdownArrow}
            onBlur={closeAfterBlur}
            onClick={() => setOpen(!open)}
        >
            {valueLabel}
        </button>

        {
            open &&
                <select
                    ref={optionsRef}
                    value={options.findIndex(option => deepEqual(option[0], selected))}
                    autoFocus={true}
                    className={widgets.floatingSelect}
                    onBlur={closeAfterBlur}
                    onChange={change}
                    onClick={() => acceptSelection()}
                    onKeyDown={e => e.key === "Enter" && acceptSelection()}
                    size={options.length}
                >
                    {
                        options.map((option, i) =>
                            <option key={i} value={i}>{option[1]}</option>)
                    }
                </select>
        }
    </>;
}
