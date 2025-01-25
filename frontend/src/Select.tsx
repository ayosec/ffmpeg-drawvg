import { useEffect, useRef, useState } from "react";

import basics from "./layout.module.css";

interface Props<T> {
    title?: string;
    value: T;
    options: T[];
    onChange: (value: T) => void;
}

export default function Select<T extends string|number>({title, value, options, onChange}: Props<T>) {
    const [ open, setOpen ] = useState(false);

    const selectRef = useRef<HTMLSelectElement|null>(null);

    useEffect(() => {
        if (open && selectRef.current !== null) {
            selectRef.current.focus();
            selectRef.current.showPicker?.();
        }
    }, [ open ]);

    if (!open) {
        return (
            <button
                aria-label={title}
                className={basics.select}
                onClick={() => setOpen(true)}
            >
                {value}
            </button>
        );
    }

    const change = (index: number) => {
        onChange(options[index]);
        setOpen(false);
    };

    return (
            <select
                value={options.findIndex(option => option === value)}
                ref={selectRef}
                className={basics.select}
                onChange={e => change(parseFloat(e.target.value))}
                onBlur={() => setOpen(false)}
            >
                {
                    options.map((option, i) =>
                        <option key={i} value={i}>{option}</option>
                    )
                }
            </select>
    );
}
