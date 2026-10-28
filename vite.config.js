import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: resolve(projectRoot, "index.html"),
        admin: resolve(projectRoot, "admin.html")
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) return "firebase";
          if (id.includes("node_modules/canvas-confetti")) return "effects";
          return undefined;
        }
      }
    }
  }
});
