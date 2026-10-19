import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// A estação de gestos precisa de cross-origin isolation para o ONNX Runtime usar
// várias threads no WASM. Aplicamos só nela para não afetar as outras páginas.
function isOtherPageDocument(req: IncomingMessage) {
  return (
    req.headers['sec-fetch-dest'] === 'document' &&
    !req.url?.startsWith('/gesture-station/')
  )
}

function gestureStationIsolation(): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!isOtherPageDocument(req)) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
    }
    next()
  }
  return {
    name: 'gesture-station-isolation',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), gestureStationIsolation()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
