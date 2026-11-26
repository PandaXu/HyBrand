const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { BrowserWindow } = require('electron')

let dataDir = ''
let libraryPath = ''
let state = null
let saveTimer = null
let broadcastTimer = null

function normalizeAsset(asset) {
  return {
    id: asset.id,
    name: asset.name || '未命名',
    ext: asset.ext || '',
    kind: asset.kind || 'other',
    mime: asset.mime || 'application/octet-stream',
    size: Number(asset.size) || 0,
    width: asset.width || null,
    height: asset.height || null,
    aspect: asset.aspect || null,
    duration: asset.duration || null,
    hash: asset.hash || '',
    folderId: asset.folderId || null,
    note: asset.note || '',
    tags: Array.isArray(asset.tags) ? asset.tags : [],
    aiTags: Array.isArray(asset.aiTags) ? asset.aiTags : [],
    colors: Array.isArray(asset.colors) ? asset.colors : [],
    favorite: Boolean(asset.favorite),
    trashed: Boolean(asset.trashed),
    importedAt: asset.importedAt || new Date().toISOString(),
    updatedAt: asset.updatedAt || asset.importedAt || new Date().toISOString(),
    previewPath: asset.previewPath || null,
    featurePath: asset.featurePath || null,
    status: asset.status || 'ready',
    comments: Array.isArray(asset.comments) ? asset.comments : []
  }
}

const LOGO_ROLES = new Set(['primary', 'reverse', 'monochrome', 'horizontal', 'vertical', 'icon'])
const TYPE_ROLES = new Set(['brand', 'heading', 'body'])

function normalizeBrand(brand) {
  const source = brand && typeof brand === 'object' ? brand : {}
  const now = new Date().toISOString()
  const colors = (Array.isArray(source.colors) ? source.colors : [])
    .filter((color) => color && typeof color === 'object')
    .map((color) => {
      const hex = String(color.hex || '')
      return {
        id: typeof color.id === 'string' && color.id ? color.id : crypto.randomUUID(),
        name: String(color.name || '品牌色').slice(0, 40),
        hex: /^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : '#5B6CFF',
        pantone: String(color.pantone || '').slice(0, 40)
      }
    })

  const logoVariants = (Array.isArray(source.logoVariants) ? source.logoVariants : [])
    .filter((variant) => variant && typeof variant.assetId === 'string' && variant.assetId)
    .map((variant) => ({
      id: typeof variant.id === 'string' && variant.id ? variant.id : crypto.randomUUID(),
      assetId: variant.assetId,
      role: LOGO_ROLES.has(variant.role) ? variant.role : 'primary',
      label: String(variant.label || '').slice(0, 80),
      minWidth: String(variant.minWidth || '').slice(0, 60),
      clearSpace: String(variant.clearSpace || '').slice(0, 80),
      note: String(variant.note || '').slice(0, 500)
    }))

  const typography = (Array.isArray(source.typography) ? source.typography : [])
    .filter((item) => item && typeof item.assetId === 'string' && item.assetId)
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      assetId: item.assetId,
      role: TYPE_ROLES.has(item.role) ? item.role : 'brand',
      name: String(item.name || '').slice(0, 80),
      note: String(item.note || '').slice(0, 500),
      sample: String(item.sample || '').slice(0, 200)
    }))

  return {
    id: typeof source.id === 'string' && source.id ? source.id : crypto.randomUUID(),
    name: String(source.name || '').slice(0, 80),
    tagline: String(source.tagline || '').slice(0, 160),
    description: String(source.description || '').slice(0, 2000),
    voice: String(source.voice || '').slice(0, 5000),
    colors,
    logoVariants,
    typography,
    lastExportedAt: source.lastExportedAt || null,
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now
  }
}

function normalize(data) {
  const assets = Array.isArray(data.assets) ? data.assets.map(normalizeAsset) : []
  const folders = Array.isArray(data.folders)
    ? data.folders
        .filter((folder) => folder && folder.id && folder.name)
        .map((folder) => ({
          id: folder.id,
          name: String(folder.name),
          parentId: folder.parentId || null,
          createdAt: folder.createdAt || new Date().toISOString()
        }))
    : []
  return {
    version: 1,
    assets,
    folders,
    brand: normalizeBrand(data.brand),
    settings: data.settings && typeof data.settings === 'object' ? data.settings : {}
  }
}

function readLibrary(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.assets)) return null
    return normalize(parsed)
  } catch {
    return null
  }
}

function init(dir) {
  dataDir = dir
  libraryPath = path.join(dataDir, 'library.json')
  for (const sub of ['files', 'previews', 'features']) {
    fs.mkdirSync(path.join(dataDir, sub), { recursive: true })
  }

  try {
    fs.rmSync(`${libraryPath}.tmp`, { force: true })
  } catch {
    // 忽略残留临时文件
  }

  const primary = readLibrary(libraryPath)
  if (primary) {
    state = primary
    return
  }

  const backup = readLibrary(`${libraryPath}.bak`)
  if (backup) {
    try {
      if (fs.existsSync(libraryPath)) {
        fs.renameSync(libraryPath, `${libraryPath}.corrupt-${Date.now()}`)
      }
    } catch {
      // 保留损坏文件，继续用备份恢复
    }
    state = backup
    return
  }

  if (fs.existsSync(libraryPath)) {
    throw new Error(`素材库索引损坏，请检查 ${libraryPath}`)
  }

  state = normalize({ assets: [], folders: [], settings: {} })
}

function getDataDir() {
  return dataDir
}

function getDirs() {
  return {
    files: path.join(dataDir, 'files'),
    previews: path.join(dataDir, 'previews'),
    features: path.join(dataDir, 'features')
  }
}

function getState() {
  return state
}

function getAsset(id) {
  return state.assets.find((asset) => asset.id === id) || null
}

function originalPath(asset) {
  const fileName = asset.ext ? `${asset.id}.${asset.ext}` : asset.id
  return path.join(getDirs().files, fileName)
}

function previewFilePath(asset) {
  return asset.previewPath ? path.join(getDirs().previews, asset.previewPath) : null
}

function featureFilePath(asset) {
  return asset.featurePath ? path.join(getDirs().features, asset.featurePath) : null
}

function snapshot() {
  let active = 0
  let trash = 0
  let bytes = 0
  for (const asset of state.assets) {
    if (asset.trashed) trash += 1
    else active += 1
    bytes += asset.size || 0
  }
  return {
    version: state.version,
    assets: state.assets,
    folders: state.folders,
    brand: state.brand,
    stats: {
      active,
      trash,
      bytes,
      total: state.assets.length
    },
    dataDir
  }
}

function saveNow() {
  clearTimeout(saveTimer)
  saveTimer = null
  if (!libraryPath) return
  const tmp = `${libraryPath}.tmp`
  try {
    fs.writeFileSync(tmp, JSON.stringify(state), 'utf8')
    if (fs.existsSync(libraryPath)) {
      fs.renameSync(libraryPath, `${libraryPath}.bak`)
    }
    fs.renameSync(tmp, libraryPath)
  } catch (error) {
    console.error('[HyBrand] 保存素材库失败', error)
  }
}

function broadcastNow() {
  clearTimeout(broadcastTimer)
  broadcastTimer = null
  const payload = snapshot()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('library:changed', payload)
  }
}

function touch() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNow, 200)
  clearTimeout(broadcastTimer)
  broadcastTimer = setTimeout(broadcastNow, 150)
}

function flush() {
  saveNow()
}

function folderDescendants(folderId) {
  const result = new Set([folderId])
  let changed = true
  while (changed) {
    changed = false
    for (const folder of state.folders) {
      if (folder.parentId && result.has(folder.parentId) && !result.has(folder.id)) {
        result.add(folder.id)
        changed = true
      }
    }
  }
  return result
}

module.exports = {
  init,
  getDataDir,
  getDirs,
  getState,
  getAsset,
  originalPath,
  previewFilePath,
  featureFilePath,
  snapshot,
  touch,
  flush,
  folderDescendants
}
