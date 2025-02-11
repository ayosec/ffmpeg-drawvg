import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./base/App";
import initKeyboardShortcuts from "./base/keyshortcuts";
import initTooltips from "./base/tooltips";
import { BackendProvider } from "./backend";

import "@fontsource-variable/quicksand/index.css";
import "@fontsource-variable/roboto-mono/index.css";

import "./root.css";
import "./theme.css";

initTooltips(document.body);
initKeyboardShortcuts(document.body);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BackendProvider>
            <App />
        </BackendProvider>
    </StrictMode>,
);
