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
