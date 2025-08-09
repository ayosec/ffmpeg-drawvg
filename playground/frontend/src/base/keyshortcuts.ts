export default function initKeyboardShortcuts(parent: HTMLElement) {
    parent.addEventListener("keydown", (event) => {
        // All shortcuts must use the <Control> key and, optionally, <Shift>.
        if (!event.ctrlKey || event.altKey || event.metaKey)
            return;

        const seq = `ctrl${event.shiftKey ? "-shift" : ""}-${event.key}`;

        const button = parent.querySelector<HTMLButtonElement>(`button[data-shortcut="${seq}" i]`);
        if (button) {
            event.preventDefault();

            button.click();

            button.animate(
                [
                    {},
                    { boxShadow: "0 0 1ch" },
                    {}
                ], {
                    duration: 250,
                    easing: "ease-out",
                    iterations: 1,
                }
            );
        }
    });
}
