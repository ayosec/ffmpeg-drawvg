import { useRef, useState } from "react";

import { MdOutlineDarkMode, MdOutlineLightMode } from "react-icons/md";

import styles from "./header.module.css";

enum Theme {
    Dark = "dark",
    Light = "light",
}

function getColorScheme() {
    if (matchMedia("(prefers-color-scheme: dark)").matches)
        return Theme.Dark;
    else
        return Theme.Light;
}

function ThemeSwitcher() {
    const [ theme, setTheme ] = useState(getColorScheme);

    const animationTask = useRef<ReturnType<typeof setTimeout>|null>(null);

    const toggle = () => {
        setTheme(theme === Theme.Dark ? Theme.Light : Theme.Dark);

        if (animationTask.current !== null)
            clearTimeout(animationTask.current);

        animationTask.current = setTimeout(
            () => {
                animationTask.current = null;
                document.body.classList.remove(styles.animatedColors);
            },
            500,
        );

        document.body.classList.add(styles.animatedColors);
    };

    return (
        <div
            id="selected-theme"
            className={styles.optionSwitcher}
            data-select-theme={theme}
            data-option-highlight={theme === Theme.Light ? "right" : "left"}
            onClick={toggle}
        >
            <MdOutlineDarkMode size="10px" />
            <MdOutlineLightMode size="10px" />
        </div>
    );
}

export default function Header() {
    return (
        <header className={styles.header}>
            <div className={styles.title}>FFmpeg - drawvg</div>

            <div className={styles.actions}>
                <ThemeSwitcher />
            </div>
        </header>
    );
}
