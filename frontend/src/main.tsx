import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { BackendProvider } from "./backend";

import "./root.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BackendProvider>
            <App />
        </BackendProvider>
    </StrictMode>,
);
