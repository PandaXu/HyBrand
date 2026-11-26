const { nativeImage } = require('electron')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const fs = require('node:fs')
const fsp = fs.promises
const os = require('node:os')
const path = require('node:path')

const execFileAsync = promisify(execFile)

function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * macOS QuickLook 缩略图（Electron 原生 API，走 QLThumbnailGenerator）。
 * 覆盖 HEIC/PSD/PDF/视频等 Chromium 无法直接解码的格式。
 */
async function nativePreview(sourcePath, destPath) {
  const image = await withTimeout(
    nativeImage.createThumbnailFromPath(sourcePath, { width: 1200, height: 1200 }),
    15000,
    '生成缩略图超时'
  )
  if (!image || image.isEmpty()) throw new Error('未生成缩略图')
  await fsp.writeFile(destPath, image.toPNG())
  return destPath
}

/**
 * 兜底：qlmanage -t，处理个别原生 API 返回空的格式。
 */
async function quickLookPreview(sourcePath, destPath) {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'hybrand-ql-'))
  try {
    await execFileAsync(
      '/usr/bin/qlmanage',
      ['-t', '-s', '1200', '-o', tmp, sourcePath],
      { timeout: 30000, maxBuffer: 1024 * 1024 }
    )
    const files = await fsp.readdir(tmp)
    const png = files.find((file) => file.toLowerCase().endsWith('.png'))
    if (!png) throw new Error('QuickLook 未生成缩略图')
    await fsp.copyFile(path.join(tmp, png), destPath)
    return destPath
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}

async function createPreview(sourcePath, destPath) {
  try {
    return await nativePreview(sourcePath, destPath)
  } catch {
    return quickLookPreview(sourcePath, destPath)
  }
}

module.exports = { createPreview }
