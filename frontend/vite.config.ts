import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  optimizeDeps: {
    include: ['dwv', 'konva'],
  },
  server: {
    port: 5173,
    proxy: {
      '/elqueue': {
        target: 'http://localhost:8005',
        rewrite: (path) => path.replace(/^\/elqueue/, ''),
      },
      '/ris': {
        target: 'http://26.150.162.207:8000',
        rewrite: (path) => path.replace(/^\/ris/, ''),
      },
      '/api/v1': {
        target: 'http://26.150.162.207:8000',
        changeOrigin: false,
      },
      '/dicom': {
        target: 'http://26.150.162.207:8000',
        changeOrigin: true,
      },
    },
  },
})
