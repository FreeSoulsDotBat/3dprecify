import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// base: "./" for Capacitor/relative hosting. Single React (dedupe) per ADR-0004.
export default defineConfig({
  base: "./",
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
