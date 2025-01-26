import { IconType } from "react-icons/lib";

import styles from "./layout.module.css";

interface Props {
    icon: IconType;
    label?: string;
    onClick: () => void;
}

export default function IconButton({ icon, label, onClick }: Props) {
    return (
        <button
            aria-label={label}
            className={styles.button}
            onClick={onClick}
        >
            { icon({ size: "10px"}) }
        </button>
    );
}
