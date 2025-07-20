import { IconType } from "react-icons/lib";

import { capitalize } from "../utils/strings";

import styles from "../base/widgets.module.css";

interface Props {
    label?: string;
    Icon: IconType;
    iconStyle?: React.CSSProperties;
    shortcut?: string;
    onClick: () => void;
}

export default function IconButton({ label, Icon, iconStyle, shortcut, onClick }: Props) {
    const ariaShortcut = shortcut
        ? shortcut.split("-").map(capitalize).join("+")
        : undefined;

    return (
        <button
            aria-label={label}
            className={styles.button}
            data-shortcut={shortcut}
            aria-keyshortcuts={ariaShortcut}
            onClick={onClick}
        >
            <Icon size="10px" style={iconStyle} />
        </button>
    );
}
