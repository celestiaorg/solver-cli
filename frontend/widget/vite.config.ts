import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import { dependencies } from "./package.json";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    nodePolyfills({
      include: ["buffer", "crypto", "stream", "http", "https", "zlib", "vm"],
    }),
    react(),
    dts({
      outDir: "dist",
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    sourcemap: mode !== "production" && process.env.CI !== "true",
    emptyOutDir: false,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
      },
      name: "CelestiaBridgeWidget",
      formats: ["es", "cjs"],
      fileName: (format, entryName) => {
        if (format === "cjs") {
          return `${entryName}.cjs`;
        }
        return `${entryName}.${format}.js`;
      },
    },
    rollupOptions: {
      external: [...Object.keys(dependencies), "react/jsx-runtime"],
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "styles.css";
          }
          return assetInfo.name || "assets/[name].[ext]";
        },
      },
    },
  },
}));
