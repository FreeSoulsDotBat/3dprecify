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
      manifest: {
        name: "Precifica3D",
        short_name: "Precifica3D",
        description: "Precificadora para impressão 3D",
        lang: "pt-BR",
        theme_color: "#7800ff",
        background_color: "#0f0f12",
        display: "standalone",
        // TODO: icons generated from the Truth's Forge logo symbol (asset pipeline).
        icons: [],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    dedupe: ["react", "react-dom"],
  },
});
