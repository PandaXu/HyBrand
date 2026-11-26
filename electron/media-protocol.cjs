const { protocol } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { Readable } = require('node:stream')
const store = require('./store.cjs')
const { parseRange } = require('./range.cjs')

const tempFiles = new Map()

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp',
  heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', flv: 'video/x-flv',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
  flac: 'audio/flac', ogg: 'audio/ogg', aiff: 'audio/aiff',
  pdf: 'application/pdf',
  ttf: 'font/ttf', otf: 'font/otf', ttc: 'font/collection', woff: 'font/woff', woff2: 'font/woff2'
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  return MIME[ext] || 'application/octet-stream'
}

function notFound() {
  return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } })
}

function resolveRequest(url) {
  const host = url.hostname
  const id = decodeURIComponent(url.pathname.replace(/^\//, ''))

  if (host === 'asset') {
    const asset = store.getAsset(id)
    if (!asset) return null
    return { filePath: store.originalPath(asset), cache: 'public, max-age=31536000, immutable' }
  }

  if (host === 'preview') {
    const asset = store.getAsset(id)
    const filePath = asset ? store.previewFilePath(asset) : null
    if (!filePath) return null
    return { filePath, cache: 'no-store' }
  }

  if (host === 'temp') {
    const filePath = tempFiles.get(id)
    if (!filePath) return null
    return { filePath, cache: 'no-store' }
  }

  return null
}

async function handle(request) {
  let url
  try {
    url = new URL(request.url)
  } catch {
    return notFound()
  }

  const target = resolveRequest(url)
  if (!target) return notFound()

  let stat
  try {
    stat = await fs.promises.stat(target.filePath)
  } catch {
    return notFound()
  }
  if (!stat.isFile()) return notFound()

  const size = stat.size
  const headers = {
    'Content-Type': mimeFor(target.filePath),
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Cache-Control': target.cache
  }

  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: { ...headers, 'Content-Length': String(size) }
    })
  }

  const rangeHeader = request.headers.get('range')
  if (rangeHeader) {
    const range = parseRange(rangeHeader, size)
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` }
      })
    }
    const { start, end } = range
    const stream = fs.createReadStream(target.filePath, { start, end })
    return new Response(Readable.toWeb(stream), {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1)
      }
    })
  }

  const stream = fs.createReadStream(target.filePath)
  return new Response(Readable.toWeb(stream), {
    status: 200,
    headers: { ...headers, 'Content-Length': String(size) }
  })
}

function registerMediaProtocol() {
  protocol.handle('hybrand', handle)
}

function addTempFile(filePath) {
  const token = crypto.randomUUID()
  tempFiles.set(token, filePath)
  return token
}

function clearTemp(token) {
  const filePath = tempFiles.get(token)
  if (!filePath) return
  tempFiles.delete(token)
  fs.promises.rm(filePath, { force: true }).catch(() => {})
}

function clearAllTemps() {
  for (const [token, filePath] of tempFiles) {
    tempFiles.delete(token)
    fs.promises.rm(filePath, { force: true }).catch(() => {})
  }
}

module.exports = { registerMediaProtocol, addTempFile, clearTemp, clearAllTemps }
