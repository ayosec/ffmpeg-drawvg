document.addEventListener("DOMContentLoaded", () => {
    if(!navigator.clipboard || !navigator.clipboard.writeText) {
        console.log("clipboard.writeText not available.\nIt is required for the 'Copy' button in code snippets.");
        return;
    }

    const runCopy = (e) => {
        e.preventDefault();

        const button = e.target.closest(".copy-button");
        navigator.clipboard.writeText(button.dataset.src).then(
            () => {
                button.classList.add("copied");
                setTimeout(() => button.classList.remove("copied"), 1500);
            },
            () => console.error("Failed to write text to clipboard"),
        );
    };

    for(const button of document.querySelectorAll(".source .copy-button svg")) {
        button.style.display = "unset";
        button.addEventListener("click", runCopy);
    }
});
