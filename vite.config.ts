import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build` makes a normal multi-file build in dist/.
// `npm run build:single` inlines everything into one dist-single/index.html,
// which is handy for sharing a test copy as a single file.
export default defineConfig(({ mode }) => ({
  plugins: mode === "single" ? [react(), viteSingleFile()] : [react()],
  build: mode === "single" ? { outDir: "dist-single" } : { outDir: "dist" },
}));
