import Help from "../base/Help";
import tokenize from "../vgs/tokenizer";
import { Instructions } from "@backend/syntax";

export default function keyMapHandler(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey)
        return;

    const textarea = event.currentTarget;

    const { selectionStart, selectionEnd } = textarea;

    const insertText = (text: string, reselect: boolean = true) => {
        if (document.activeElement !== textarea)
            return;

        (<any>document).execCommand("insertText", false, text);

        // Re-select inserted text.
        if (reselect && selectionEnd !== selectionStart) {
            textarea.setSelectionRange(
                selectionStart,
                selectionStart + text.length,
            );
        }
    };

    const selectedText = () => textarea.value.slice(selectionStart, selectionEnd);

    const prefixLine = () =>
        textarea.value.slice(
            textarea.value.lastIndexOf("\n", selectionStart - 1) + 1,
            selectionStart,
        );

    if (selectionStart === selectionEnd) {
        // Mappings when there is no selection.

        switch (event.key) {
            case "Tab":
                if (event.shiftKey)
                    return;

                // Insert a tab only if the caret is preceded by whitespaces.
                if (prefixLine().trim().length !== 0)
                    return;

                insertText("\t");
                break;

            case "Enter": {
                const pl = prefixLine();

                // Extract current indentation.
                let indent = /^\s+/.exec(pl)?.[0] ?? "";

                // If the line is only whitespaces, replace it with an empty
                // line.
                if (indent === pl && textarea.selectionStart > 0) {
                    textarea.selectionStart -= indent.length + 1;
                    insertText("\n\n" + indent);
                    break;
                }

                // Increase indentation if the current line ends with `{`.
                if (/\{\s*$/.exec(pl))
                    indent += "\t";

                insertText("\n" + indent);
                break;
            }

            case "}":
                // Reduce indentation.
                if (textarea.value[selectionStart - 1] === "\t") {
                    textarea.selectionStart -= 1;
                    insertText("}");
                    break;
                }

                return;

            case "F1": {
                let lastInst = null;

                const pos = textarea.selectionStart;

                // Open the reference for the current command.
                for (const token of tokenize(textarea.value)) {
                    let isInst = false;

                    if (token.kind === "keyword" && Instructions.has(token.lexeme)) {
                        lastInst = token;
                        isInst = true;
                    }

                    if (token.offset + token.lexeme.length > pos) {
                        let inst = null;

                        if (isInst) {
                            inst = token.lexeme;
                        } else if (token.kind === "whitespace" && token.line === lastInst?.line) {
                            inst = lastInst.lexeme;
                        } else if (token.param) {
                            inst = token.param?.inst;
                        }

                        if (inst) {
                            const url = Help.docURL("Language") + "#cmd_" + inst;
                            window.open(url, "_blank");
                        }

                        break;
                    }
                }

                break;
            }

            default:
                return;
        }
    } else {
        // Mappings when there selected text.

        switch (event.key) {
            case "Tab": {
                const bol = textarea.value.lastIndexOf("\n", selectionStart - 1) + 1;

                let eol = textarea.value.indexOf("\n", selectionEnd);
                if (eol < 0)
                    eol = textarea.value.length;

                const fullLines = textarea.value.slice(bol, eol);
                const updated = event.shiftKey
                    ? fullLines.replace(/^[\t ]/gm, "")
                    : fullLines.replace(/^[\t ]*\S+/gm, "\t$&");

                textarea.setSelectionRange(bol, eol);
                insertText(updated, false);
                textarea.setSelectionRange(bol, bol + updated.length);

                break;
            }

            case "/":
                insertText(
                    selectedText().replace(
                        /(^[\t ]*)(\/\/\s?)?(.*)/gm,
                        (_, indent, c, s) => (
                            indent + (c || !s.length ? "" : "// ") + s
                        ),
                    ),
                );
                break;

            case "(":
            case ")":
                insertText("(" + selectedText() + ")");
                break;

            default:
                return;
        }
    }

    event.preventDefault();
}
