import { useRef, useState } from "react";

import { MdOutlineDarkMode, MdOutlineLightMode } from "react-icons/md";
import { RiLayout2Line, RiLayoutRowLine } from "react-icons/ri";

import useAppLayout, { Layout } from "./layout";

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

function LayoutSwitcher() {
    const layout = useAppLayout(s => s.layout);
    const setLayout = useAppLayout(s => s.setLayout);

    const onToggleLayout = () => {
        setLayout(layout === Layout.Main ? Layout.Vertical : Layout.Main);
    };

    return (
        <div
            className={styles.optionSwitcher}
            aria-label="Layout"
            data-option-highlight={layout == Layout.Main ? "left" : "right"}
            onClick={onToggleLayout}
        >
            <RiLayout2Line size="10px" />
            <RiLayoutRowLine size="10px" />
        </div>
    );
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
            aria-label="Theme"
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
                <LayoutSwitcher />
                <ThemeSwitcher />
            </div>
        </header>
    );
}
