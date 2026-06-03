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
        target: 'http://localhost:8000',
        rewrite: (path) => path.replace(/^\/ris/, ''),
      },
      '/api/v1': {
        target: 'http://localhost:8000',
        changeOrigin: false,
      },
      '/dicom-files': {
        target: 'http://localhost:8042',
        rewrite: (path) => path.replace(/^\/dicom-files/, '/instances'),
        changeOrigin: true,
      },
      '/dicom': {
        target: 'http://localhost:8042',
        rewrite: (path) => path.replace(/^\/dicom/, '/dicom-web'),
        changeOrigin: true,
      },
    },
  },
})
