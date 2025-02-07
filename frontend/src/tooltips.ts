// Replace some hard-to-see keys with the full name.
const KEY_NAMES: {[key:string]: string} = {
    ",": "comma",
    ".": "period",
};

function makeFloatingBox(parent: HTMLElement) {
    const ID = "tooltip-floating-box";
    let node = <HTMLSpanElement|null>parent.querySelector("span#" + ID);
    if (node !== null)
        return node;

    node = document.createElement("span");
    node.id = ID;
    parent.appendChild(node);
    return node;
}

function configureTooltop(tooltipBox: HTMLElement, target: HTMLElement) {

    const label = target?.ariaLabel;
    if (!label)
        return;

    tooltipBox.innerText = label;

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

    const clientWidth = window.innerWidth - 10;
    const clientHeight = window.innerHeight - 10;

    const { width: boxWidth, height: boxHeight } = tooltipBox.getBoundingClientRect();
    const parent = target.getBoundingClientRect();

    let boxLeft = parent.x + (parent.width - boxWidth) / 2;
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
    const Box = makeFloatingBox(parent);
    Box.innerText = "";

    parent.addEventListener("mouseenter", event => {
        const target = <HTMLElement|null>event.target;
        if (target)
            configureTooltop(Box, target);
    }, true);
}
