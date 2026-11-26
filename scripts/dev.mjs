import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bin = (name) => path.join(root, 'node_modules', '.bin', name)
const DEV_URL = 'http://localhost:5173'

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Vite 还未就绪
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`等待 Vite 超时：${url}`)
}

let vite
let electron
let exiting = false

function shutdown(code = 0) {
  if (exiting) return
  exiting = true
  try {
    electron?.kill('SIGTERM')
  } catch {}
  try {
    vite?.kill('SIGTERM')
  } catch {}
  setTimeout(() => process.exit(code), 150)
}

vite = spawn(bin('vite'), [], { cwd: root, stdio: 'inherit', env: process.env })
vite.on('exit', (code) => {
  if (!exiting) {
    console.error('[HyBrand] Vite 已退出')
    shutdown(code || 1)
  }
})

try {
  await waitForServer(DEV_URL)
} catch (error) {
  console.error(error.message)
  shutdown(1)
}

electron = spawn(bin('electron'), ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: DEV_URL }
})
electron.on('exit', (code) => shutdown(code || 0))

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
