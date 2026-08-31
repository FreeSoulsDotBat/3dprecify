import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// 016/T072-A4 (2026-08-07) — `base: "./"` unconditional was the ROOT CAUSE of the "2-segment
// cold-load blank page" trap (013/F-02, deep-links.spec.ts's documented gap): with a RELATIVE
// base, index.html's `<script src="./assets/…">` resolves against the CURRENT PATH, so a cold
// hit on `/catalogo/produtos/xxx` requests `/catalogo/produtos/assets/…` — a 404, and a blank
// page with no React ever mounted to show even a 404 screen. Measured directly on the built
// index.html before this fix: `src="./assets/index-*.js"` (relative), confirmed 404 by path
// arithmetic. `base: "/"` (absolute) is correct for THIS app's actual hosting (Firebase Hosting
// SPA rewrites `**` → index.html, `firebase.json`'s redirects handle the old 2-segment URLs
// BEFORE the app boots) and for `vite preview`'s own SPA html-fallback (same absolute-path
// reasoning). `"./"` is kept ONLY for the future Capacitor/Android packaging (E7), which serves
// from a `file://`/`capacitor://` root where a relative base is the one that resolves — opted in
// via `CAPACITOR=1` at build time, never the default.
export default defineConfig({
    base: process.env.CAPACITOR === "1" ? "./" : "/",
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: "autoUpdate",
            // Brand assets in public/ that the SW should precache for offline (FR-008).
            // The brand marks are precached (009/T016-N5): `Logo` renders them as `<img src="/brand/…">`,
            // which the service worker never cached — so OFFLINE the top bar showed a broken-image icon
            // and the alt text. A pre-existing app-shell gap, but it surfaces on the very screen E4 just
            // won (the seller working offline at a feira), and it is the first thing they see there.
            includeAssets: [
                "favicon.svg",
                "icons/icon-192.png",
                "icons/icon-512.png",
                "brand/logo/*.svg",
                // 016/T072-A1 — a MESMA classe do 009/T016-N5, reintroduzida pela PR-B: a logo real virou
                // PNG (logo-inteira-{white,black}.png) e o glob acima só cobria *.svg — offline, a
                // primeira dobra voltou a mostrar o ícone de imagem quebrada. Medido: naturalWidth 0 em
                // boot frio com SW. O glob por EXTENSÃO é o defeito recorrente; *.png fecha o par.
                "brand/logo/*.png",
            ],
            // SPA offline routing: serve the precached app shell for any navigation when
            // offline, so a reload (or deep link) still boots and the calculator runs.
            workbox: {
                navigateFallback: "index.html",
                navigateFallbackDenylist: [/^\/api\//],
            },
            manifest: {
                name: "Precifica3D",
                short_name: "Precifica3D",
                description: "Precificadora para impressão 3D",
                lang: "pt-BR",
                theme_color: "#7800ff",
                background_color: "#0f0f12",
                display: "standalone",
                // Truth's Forge app icons (vendored from the Claude Design project). Maskable
                // variant is a follow-up (TD-016) — needs a padded safe-zone render.
                icons: [
                    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
                    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
                ],
            },
        }),
    ],
    resolve: {
        alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
        dedupe: ["react", "react-dom"],
    },
});
