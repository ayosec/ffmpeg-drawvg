import { InstructionsDecls } from "@backend/syntax";

const DECLS = (() => {
    // The items extracted from the C source are strings with
    // the format `inst, alias (params)`.
    //
    // Process them to store them as `inst -> params` entries.

    const decls = new Map<string, readonly string[]>();

    for (const decl of InstructionsDecls) {
        const m = /(.*)?\((.*)\)/.exec(decl);
        if (m !== null) {
            const params = m[2].split(/\s+/);
            for (const inst of m[1].split(",")) {
                decls.set(inst.trim(), params);
            }
        }
    }

    return decls;
})();

export function getParameters(instruction: string): readonly string[]|undefined {
    return DECLS.get(instruction);
}
