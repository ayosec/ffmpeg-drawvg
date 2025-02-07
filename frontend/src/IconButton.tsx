import { IconType } from "react-icons/lib";

import styles from "./widgets.module.css";

interface Props {
    label?: string;
    icon: IconType;
    iconStyle?: React.CSSProperties;
    shortcut?: string;
    onClick: () => void;
}

export default function IconButton({ label, icon, iconStyle, shortcut, onClick }: Props) {
    return (
        <button
            aria-label={label}
            className={styles.button}
            data-shortcut={shortcut}
            onClick={onClick}
        >
            { icon({ size: "10px", style: iconStyle}) }
        </button>
    );
}
