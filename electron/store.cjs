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
    linkedFolderIds: Array.isArray(asset.linkedFolderIds)
      ? [...new Set(asset.linkedFolderIds.filter((id) => typeof id === 'string' && id))]
      : [],
    spaceId: asset.spaceId || null,
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
const COLOR_CATEGORIES = new Set(['primary', 'secondary', 'accent', 'neutral', 'background', 'text'])
const FONT_WEIGHTS = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900])

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
        pantone: String(color.pantone || '').slice(0, 40),
        category: COLOR_CATEGORIES.has(color.category) ? color.category : 'primary',
        usage: String(color.usage || '').slice(0, 200)
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
      family: String(item.family || item.name || '品牌字体').slice(0, 80),
      name: String(item.name || '').slice(0, 80),
      note: String(item.note || '').slice(0, 500),
      sample: String(item.sample || '').slice(0, 200),
      weight: FONT_WEIGHTS.has(Number(item.weight)) ? Number(item.weight) : 400
    }))

  const typefaceIds = new Set(typography.map((item) => item.id))
  const stepKeys = ['display', 'h1', 'h2', 'h3', 'body', 'caption']
  const headingKeys = new Set(['display', 'h1', 'h2', 'h3'])
  const legacyHeading =
    typography.find((item) => item.role === 'heading') ||
    typography.find((item) => item.role === 'brand') ||
    typography[0] ||
    null
  const legacyBody =
    typography.find((item) => item.role === 'body') ||
    typography.find((item) => item.role === 'brand') ||
    typography[0] ||
    null
  const rawSteps =
    source.typeScale && typeof source.typeScale.steps === 'object' && source.typeScale.steps
      ? source.typeScale.steps
      : null
  const steps = {}
  for (const key of stepKeys) {
    const raw = rawSteps && rawSteps[key] ? rawSteps[key] : null
    let typefaceId = raw && typefaceIds.has(raw.typefaceId) ? raw.typefaceId : null
    if (!rawSteps) {
      typefaceId = (headingKeys.has(key) ? legacyHeading?.id : legacyBody?.id) || null
    }
    steps[key] = { typefaceId }
  }

  const rawPairings = Array.isArray(source.pairings) ? source.pairings : null
  let pairings
  if (rawPairings) {
    pairings = rawPairings
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
        name: String(item.name || '字体搭配').slice(0, 80),
        headingTypefaceId: typefaceIds.has(item.headingTypefaceId)
          ? item.headingTypefaceId
          : null,
        bodyTypefaceId: typefaceIds.has(item.bodyTypefaceId) ? item.bodyTypefaceId : null,
        note: String(item.note || '').slice(0, 1000)
      }))
      .filter((item) => item.headingTypefaceId || item.bodyTypefaceId || item.note)
  } else {
    const note = String(source.pairingNote || '').slice(0, 1000)
    const headingId = legacyHeading?.id || null
    const bodyId = legacyBody?.id || null
    pairings =
      headingId || bodyId || note
        ? [
            {
              id: crypto.randomUUID(),
              name: '主搭配',
              headingTypefaceId: headingId,
              bodyTypefaceId: bodyId,
              note
            }
          ]
        : []
  }

  return {
    id: typeof source.id === 'string' && source.id ? source.id : crypto.randomUUID(),
    name: String(source.name || '').slice(0, 80),
    tagline: String(source.tagline || '').slice(0, 160),
    description: String(source.description || '').slice(0, 2000),
    voice: String(source.voice || '').slice(0, 5000),
    typeScale: {
      base: Number.isFinite(Number(source.typeScale?.base))
        ? Math.min(24, Math.max(10, Number(source.typeScale.base)))
        : 16,
      ratio: Number.isFinite(Number(source.typeScale?.ratio))
        ? Math.min(1.6, Math.max(1.05, Number(source.typeScale.ratio)))
        : 1.25,
      steps
    },
    colors,
    logoVariants,
    typography,
    pairings,
    lastExportedAt: source.lastExportedAt || null,
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now
  }
}

function normalize(data) {
  const now = new Date().toISOString()
  const rawSpaces = Array.isArray(data.spaces)
    ? data.spaces
        .filter((space) => space && typeof space === 'object')
        .map((space) => {
          const brand = normalizeBrand(space.brand)
          return {
            id: typeof space.id === 'string' && space.id ? space.id : crypto.randomUUID(),
            name: String(space.name || brand.name || '品牌空间').slice(0, 80),
            brand,
            createdAt: space.createdAt || now
          }
        })
    : []

  let spaces = rawSpaces
  if (!spaces.length) {
    const brand = normalizeBrand(data.brand)
    spaces = [
      {
        id: brand.id || crypto.randomUUID(),
        name: brand.name || '我的品牌',
        brand,
        createdAt: brand.createdAt || now
      }
    ]
  }

  let activeSpaceId = data.activeSpaceId
  if (!spaces.some((space) => space.id === activeSpaceId)) {
    activeSpaceId = spaces[0].id
  }
  const spaceIds = new Set(spaces.map((space) => space.id))

  const assets = (Array.isArray(data.assets) ? data.assets : []).map((asset) => {
    const normalized = normalizeAsset(asset)
    return {
      ...normalized,
      spaceId: spaceIds.has(asset.spaceId) ? asset.spaceId : activeSpaceId
    }
  })
  const folders = (Array.isArray(data.folders) ? data.folders : [])
    .filter((folder) => folder && folder.id && folder.name)
    .map((folder) => ({
      id: folder.id,
      name: String(folder.name),
      parentId: folder.parentId || null,
      spaceId: spaceIds.has(folder.spaceId) ? folder.spaceId : activeSpaceId,
      createdAt: folder.createdAt || now
    }))

  const folderById = new Map(folders.map((folder) => [folder.id, folder]))
  for (const asset of assets) {
    asset.linkedFolderIds = asset.linkedFolderIds.filter((id) => {
      const folder = folderById.get(id)
      return folder && folder.spaceId === asset.spaceId && id !== asset.folderId
    })
  }

  return {
    version: 2,
    spaces,
    activeSpaceId,
    assets,
    folders,
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

function getSpace() {
  return state.spaces.find((space) => space.id === state.activeSpaceId) || state.spaces[0]
}

function getActiveSpaceId() {
  return state.activeSpaceId
}

function getSpaces() {
  return state.spaces
}

function getBrand() {
  return getSpace().brand
}

function getActiveAssets() {
  return state.assets.filter((asset) => asset.spaceId === state.activeSpaceId)
}

function getActiveFolders() {
  return state.folders.filter((folder) => folder.spaceId === state.activeSpaceId)
}

function switchSpace(spaceId) {
  if (!state.spaces.some((space) => space.id === spaceId)) return false
  state.activeSpaceId = spaceId
  touch()
  return true
}

function createSpace(name) {
  const clean = String(name || '').trim().slice(0, 80) || '新品牌空间'
  const now = new Date().toISOString()
  const brand = normalizeBrand({ name: clean })
  const space = {
    id: crypto.randomUUID(),
    name: clean,
    brand,
    createdAt: now
  }
  state.spaces.push(space)
  state.activeSpaceId = space.id
  touch()
  return space
}

function renameSpace(spaceId, name) {
  const space = state.spaces.find((item) => item.id === spaceId)
  if (!space) return null
  const clean = String(name || '').trim().slice(0, 80)
  if (!clean) return null
  space.name = clean
  if (!space.brand.name) space.brand.name = clean
  touch()
  return space
}

function deleteSpace(spaceId) {
  if (state.spaces.length <= 1) return null
  const space = state.spaces.find((item) => item.id === spaceId)
  if (!space) return null
  const removedAssets = state.assets.filter((asset) => asset.spaceId === spaceId)
  state.spaces = state.spaces.filter((item) => item.id !== spaceId)
  state.assets = state.assets.filter((asset) => asset.spaceId !== spaceId)
  state.folders = state.folders.filter((folder) => folder.spaceId !== spaceId)
  if (state.activeSpaceId === spaceId) {
    state.activeSpaceId = state.spaces[0].id
  }
  touch()
  return { removedAssets, activeSpaceId: state.activeSpaceId }
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
  const activeSpaceId = state.activeSpaceId
  const activeAssets = state.assets.filter((asset) => asset.spaceId === activeSpaceId)
  const activeFolders = state.folders.filter((folder) => folder.spaceId === activeSpaceId)
  let active = 0
  let trash = 0
  let bytes = 0
  for (const asset of activeAssets) {
    if (asset.trashed) trash += 1
    else active += 1
    bytes += asset.size || 0
  }

  const spaces = state.spaces.map((space) => {
    const assets = state.assets.filter((asset) => asset.spaceId === space.id)
    const primary = (space.brand.logoVariants || []).find((variant) => variant.role === 'primary')
    const logoAsset =
      primary &&
      state.assets.find(
        (asset) => asset.id === primary.assetId && asset.spaceId === space.id && !asset.trashed
      )
    return {
      id: space.id,
      name: space.name,
      brandName: space.brand.name || space.name,
      createdAt: space.createdAt,
      assetCount: assets.filter((asset) => !asset.trashed).length,
      primaryLogoAssetId: logoAsset?.id || null
    }
  })

  return {
    version: state.version,
    spaces,
    activeSpaceId,
    assets: activeAssets,
    folders: activeFolders,
    brand: getBrand(),
    stats: {
      active,
      trash,
      bytes,
      total: activeAssets.length
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
  getSpace,
  getActiveSpaceId,
  getSpaces,
  getBrand,
  getActiveAssets,
  getActiveFolders,
  switchSpace,
  createSpace,
  renameSpace,
  deleteSpace,
  getAsset,
  originalPath,
  previewFilePath,
  featureFilePath,
  snapshot,
  touch,
  flush,
  folderDescendants
}
