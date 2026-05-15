import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, cpSync, existsSync, readFileSync, writeFileSync } from "fs";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
        auth: resolve(__dirname, "src/auth/auth.html"),
        background: resolve(__dirname, "src/background.js"),
        content: resolve(__dirname, "src/content.js"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "[name].[ext]",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
  plugins: [
    {
      name: "copy-extension-files",
      writeBundle() {
        const dist = resolve(__dirname, "dist");

        // Copy icons
        const iconsDir = resolve(dist, "icons");
        if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
        cpSync(resolve(__dirname, "icons"), iconsDir, { recursive: true });

        // Copy manifest.json
        copyFileSync(
          resolve(__dirname, "manifest.json"),
          resolve(dist, "manifest.json")
        );

        // Fix HTML paths: move files to root and fix relative references
        const srcDir = resolve(dist, "src");
        if (existsSync(srcDir)) {
          const fixAndMove = (subPath, targetName) => {
            const srcFile = resolve(srcDir, subPath);
            const destFile = resolve(dist, targetName);
            if (existsSync(srcFile)) {
              let content = readFileSync(srcFile, "utf-8");
              // Fix relative paths from src/popup/ or src/auth/ back to dist root
              content = content.replace(/\.\.\/\.\.\//g, "./");
              writeFileSync(destFile, content);
            }
          };
          fixAndMove("popup/popup.html", "popup.html");
          fixAndMove("auth/auth.html", "auth.html");
        }
      },
    },
  ],
});
