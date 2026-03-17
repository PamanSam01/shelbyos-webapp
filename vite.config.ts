import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Provide Buffer and process globally
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  optimizeDeps: {
    include: [
      '@wallet-standard/core',
      '@telegram-apps/bridge',
      'buffer',
    ],
  },
  server: {
    hmr: {
      overlay: true,
    },
  },
})


