import { IconType } from "react-icons/lib";

import styles from "./widgets.module.css";

interface Props {
    label?: string;
    Icon: IconType;
    iconStyle?: React.CSSProperties;
    shortcut?: string;
    onClick: () => void;
}

export default function IconButton({ label, Icon, iconStyle, shortcut, onClick }: Props) {
    return (
        <button
            aria-label={label}
            className={styles.button}
            data-shortcut={shortcut}
            onClick={onClick}
        >
            <Icon size="10px" style={iconStyle} />
        </button>
    );
}
