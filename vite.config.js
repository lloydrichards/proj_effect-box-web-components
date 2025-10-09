import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";

const isLibMode = process.env.BUILD_MODE === "lib";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tsconfigPaths(),
  ],
  build: isLibMode
    ? {
        copyPublicDir: false,
        lib: {
          entry: resolve(__dirname, "lib/main.ts"),
          name: "MyElement",
          fileName: "my-element",
        },
        rollupOptions: {
          external: ["react", "react-dom", "react/jsx-runtime"],
          output: {
            globals: {
              preserveModules: true,
              react: "React",
              "react-dom": "ReactDOM",
              "react/jsx-runtime": "react/jsx-runtime",
            },
          },
        },
      }
    : {},
  server: {
    open: "/index.html",
  },
});
