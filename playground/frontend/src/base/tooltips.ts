// Replace some hard-to-see keys with the full name.
export const KEY_NAMES: {[key:string]: string} = {
    " ": "space",
    ",": "comma",
    ".": "period",
};

function makeFloatingBox(parent: HTMLElement) {
    const CLASS_NAME = "tooltip-floating-box";

    const node = parent.getElementsByClassName(CLASS_NAME)[0];
    if (node !== null && node instanceof HTMLSpanElement)
        return node;

    const newNode = document.createElement("span");
    newNode.classList.add(CLASS_NAME);
    parent.appendChild(newNode);
    return newNode;
}

function configureTooltop(container: HTMLElement, target: HTMLElement) {
    const label = target?.ariaLabel;
    if (!label)
        return;

    const tooltipBox = makeFloatingBox(container);
    tooltipBox.innerText = label;

    // Reparent if `target` is in a <dialog>.
    const dialogAncestor = target.closest("dialog");
    if (dialogAncestor !== null
        && tooltipBox.parentElement !== dialogAncestor
    ) {
        dialogAncestor.append(tooltipBox);
    }

    // Add a line with the associated shortcut.
    const shortcut = target.dataset.shortcut;
    if (shortcut) {
        const el = document.createElement("div");
        el.classList.add("kb-shortcut");

        for (const key of shortcut.split("-")) {
            const kel = document.createElement("span");
            kel.innerText = KEY_NAMES[key] ?? key;
            el.append(kel);
            el.append(" ");
        }

        tooltipBox.append(el);
    }

    // Move next to its parent.
    const clientWidth = window.innerWidth - 10;
    const clientHeight = window.innerHeight - 10;

    const { width: boxWidth, height: boxHeight } = tooltipBox.getBoundingClientRect();
    const parent = target.getBoundingClientRect();

    let boxLeft = Math.max(5, parent.x + (parent.width - boxWidth) / 2);
    if (boxLeft + boxWidth >= clientWidth)
        boxLeft = clientWidth - boxWidth;

    tooltipBox.style.left = boxLeft + "px";
    tooltipBox.style.setProperty(
        "--arrow-left",
        parent.x - boxLeft + parent.width / 2 + "px"
    );

    const parentBottom = parent.y + parent.height;
    const isBelow = parentBottom + boxHeight < clientHeight;

    if (isBelow) {
        tooltipBox.style.top = parentBottom + "px";
    } else {
        tooltipBox.style.top = parent.y - boxHeight + "px";
    }

    tooltipBox.dataset.position = isBelow ? "below" : "above";
}

export default function initTooltips(parent: HTMLElement) {
    parent.addEventListener(
        "mouseenter",
        event => {
            const target = <HTMLElement|null>event.target;
            if (target)
                configureTooltop(parent, target);
        },
        true,
    );
}
