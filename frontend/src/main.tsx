import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import initKeyboardShortcuts from "./base/keyshortcuts";
import initTooltips from "./base/tooltips";

import App from "./base/App";

import "@fontsource-variable/quicksand/index.css";
import "@fontsource-variable/roboto-mono/index.css";

import "./root.css";
import "./theme.css";

// Empty import to disable HMR when `backend` module is modified.
import {} from "./backend";

initTooltips(document.body);
initKeyboardShortcuts(document.body);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
