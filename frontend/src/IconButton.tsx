import { IconType } from "react-icons/lib";

import styles from "./widgets.module.css";

interface Props {
    label?: string;
    icon: IconType;
    iconStyle?: React.CSSProperties;
    onClick: () => void;
}

export default function IconButton({ icon, iconStyle, label, onClick }: Props) {
    return (
        <button
            aria-label={label}
            className={styles.button}
            onClick={onClick}
        >
            { icon({ size: "10px", style: iconStyle}) }
        </button>
    );
}
