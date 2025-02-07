export default function keyMapHandler(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey)
        return;

    const textarea = event.target;
    if (!(textarea instanceof HTMLTextAreaElement))
        return;

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
                    ? fullLines.replace(/^[\t ]/mg, "")
                    : fullLines.replace(/^[\t ]*\S+/gm, "\t$&");

                textarea.setSelectionRange(bol, eol);
                insertText(updated, false);
                textarea.setSelectionRange(bol, bol + updated.length);

                break;
            }

            case "/":
                insertText(
                    selectedText().replace(
                        /(^\s*)(\/\/\s?)?/mg,
                        (_, indent, cmt) => indent + (cmt ? "" : "// "),
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
