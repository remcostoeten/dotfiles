import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src")
    }
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  },
  build: {
    target: "esnext"
  },
  test: {
    environment: "jsdom",
    globals: false
  }
})
