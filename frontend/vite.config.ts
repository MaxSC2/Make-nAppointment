import { defineConfig } from 'vite'
import type { ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import net from 'node:net'

/**
 * Определяет, на каком порту живёт RIS:
 *  - 8000 — нормальный запуск
 *  - 8001 — fallback, если :8000 заблокирован ghost-сокетами
 *  - http://26.150.162.207:8000 — публичный IP, обход локальных ghost
 */
async function detectRisTarget(): Promise<string> {
  const tryConnect = (host: string, port: number, timeout = 500): Promise<boolean> =>
    new Promise((resolve) => {
      const sock = net.createConnection({ host, port })
      const onDone = (ok: boolean) => {
        sock.destroy()
        resolve(ok)
      }
      sock.once('connect', () => onDone(true))
      sock.once('error', () => onDone(false))
      sock.setTimeout(timeout, () => onDone(false))
    })

  // Сначала пробуем localhost:8000 (нормальный запуск)
  if (await tryConnect('127.0.0.1', 8000)) {
    return 'http://127.0.0.1:8000'
  }
  // Потом публичный IP на 8000
  if (await tryConnect('26.150.162.207', 8000)) {
    return 'http://26.150.162.207:8000'
  }
  // Fallback на 8001
  if (await tryConnect('127.0.0.1', 8001)) {
    return 'http://127.0.0.1:8001'
  }
  // По умолчанию — на 8000 (когда backend стартует позже Vite)
  return 'http://127.0.0.1:8000'
}

export default defineConfig(async () => {
  const risTarget = await detectRisTarget()
  const apiProxy: ProxyOptions = {
    target: risTarget,
    changeOrigin: false,
  }

  return {
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
          target: risTarget,
          rewrite: (path) => path.replace(/^\/ris/, ''),
        },
        '/api/v1': apiProxy,
        '/dicom': {
          ...apiProxy,
          changeOrigin: true,
        },
      },
    },
  }
})
