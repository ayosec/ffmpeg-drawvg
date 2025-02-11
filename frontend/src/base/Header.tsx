import { useState } from "react";

import styles from "./header.module.css";
import { MdOutlineDarkMode, MdOutlineLightMode } from "react-icons/md";

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

    const toggle = () => {
        setTheme(theme === Theme.Dark ? Theme.Light : Theme.Dark);
    };

    return (
        <div
            id="selected-theme"
            className={styles.themeSwitcher}
            data-select-theme={theme}
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
