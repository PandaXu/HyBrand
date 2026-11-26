import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' hybrand: data: blob:; media-src 'self' hybrand: data: blob:; " +
  "connect-src 'self' ws: http:; font-src 'self' hybrand: data:"

const PROD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' hybrand: data: blob:; media-src 'self' hybrand: data: blob:; " +
  "connect-src 'self'; font-src 'self' hybrand: data:"

function cspPlugin(isDev) {
  return {
    name: 'hybrand-csp',
    transformIndexHtml(html) {
      const content = isDev ? DEV_CSP : PROD_CSP
      return html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${content}" />\n  </head>`
      )
    }
  }
}

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [react(), cspPlugin(command === 'serve')],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true }
}))
