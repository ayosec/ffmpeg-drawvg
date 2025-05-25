import { Colors } from "@backend/syntax";

const LUMINANCE_THRESHOLD = 0.179;

export interface KnownColor {
    fg: string;
    bg: string;
}

type Color = readonly [number, number, number];

function luminance(color: Color): number {
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


export function foregroundColor(background: Color) {
    return luminance(background) > LUMINANCE_THRESHOLD ? "#000" : "#FFF";
}

export function parseColor(colorExpr: string): KnownColor | undefined {
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
        fg: foregroundColor(color),
        bg: `rgb(${color.join(",")})`,
    };
}
