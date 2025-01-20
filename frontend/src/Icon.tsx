import { IconType } from "react-icons";

import styles from "./layout.module.css";

interface Props {
    icon: IconType;
    label?: string;
    onClick: () => void;
}

export default function Icon({ icon, label, onClick }: Props) {
    return (
        <div
            role="button"
            aria-label={label}
            className={styles.icon}
            onClick={onClick}
        >
            { icon({ size: "90%"}) }
        </div>
    );
}
