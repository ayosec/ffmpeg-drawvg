import { Colors } from "@backend/syntax";
import tokenize from "./tokenizer";

interface Props {
    source: string;
    ref: React.MutableRefObject<HTMLPreElement | null>;
}

interface KnownColor {
    fg: string;
    bg: string;
}

function luminance(color: readonly [number, number, number]): number {
    // https://github.com/sharkdp/pastel/blob/v0.10.0/src/lib.rs#L654-L669

    const f = (s: number) => {
        if (s <= 0.03928) {
            return s / 12.92;
        } else {
            return Math.pow((s + 0.055) / 1.055, 2.4);
        }
    };

    const r = f(color[0] / 255);
    const g = f(color[1] / 255);
    const b = f(color[2] / 255);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getColor(colorExpr: string): KnownColor | undefined {
    const LUMINANCE_THRESHOLD = 0.179;

    const alphaPart = colorExpr.indexOf("@");
    if (alphaPart > 0)
        colorExpr = colorExpr.substring(0, alphaPart);

    let color;
    if (colorExpr.startsWith("#") && colorExpr.length === 7) {
        color = [
            parseInt(colorExpr.substring(1, 3), 16),
            parseInt(colorExpr.substring(3, 5), 16),
            parseInt(colorExpr.substring(5, 7), 16),
        ] as const;
    } else {
        color = Colors[colorExpr.toLowerCase()];
    }

    if (color === undefined)
        return undefined;

    return {
        fg: luminance(color) > LUMINANCE_THRESHOLD ? "#000" : "#FFF",
        bg: `rgb(${color.join(",")})`,
    };
}

export default function Highlights({ ref, source }: Props) {
    const spans = [];
    let index = 0;
    for (const token of tokenize(source)) {
        const key = `${++index}-${token.kind}-${token.lexeme}`;

        const style: React.CSSProperties = {};

        if (token.kind == "word" || token.kind == "color") {
            const knownColor = getColor(token.lexeme);
            if (knownColor) {
                style.color = knownColor.fg;
                style.backgroundColor = knownColor.bg;
            }
        }

        spans.push(
            <span
                key={key}
                style={style}
                data-kind={token.kind}
            >
                {token.lexeme}
            </span>
        );
    }

    return <pre ref={ref} aria-hidden={true}>{spans}{"\n"}</pre>;
}
