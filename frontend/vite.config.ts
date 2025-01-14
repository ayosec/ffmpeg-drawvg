import path from "path";

import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
    build: {
        sourcemap: true,
    },

    resolve: {
        alias: {
            "@backend": path.resolve(__dirname, "../backend/target/build"),
        },
    },

    plugins: [
        react(),

        viteStaticCopy({
            targets: [
                {
                    src: "../backend/target/build/*",
                    dest: "wasm-backend",
                }
            ]
        })
    ],
});
