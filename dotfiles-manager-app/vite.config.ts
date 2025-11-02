import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  resolve: {
    alias: {
      'vscode': 'monaco-languageclient/lib/vscode-compatibility'
    }
  },
  optimizeDeps: {
    include: ['monaco-editor']
  }
})

