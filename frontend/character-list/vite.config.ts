import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgrPlugin from 'vite-plugin-svgr';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), svgrPlugin()],
  server: {
    proxy: {
      '/api': {
        target: 'https://chars.theramo.re',
        changeOrigin: true,
      }
    }
  }
})
