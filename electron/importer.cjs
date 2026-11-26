const fs = require('node:fs')
const fsp = fs.promises
const path = require('node:path')
const crypto = require('node:crypto')
const store = require('./store.cjs')
const previews = require('./previews.cjs')
const vision = require('./vision.cjs')
const similar = require('./similar.cjs')

const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tif', 'tiff', 'bmp', 'avif', 'insp', 'tga', 'dds', 'jsd'])
const VIDEO = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'flv', 'mpg', 'mpeg', 'ts', 'mgb', 'rmv', 'brm', 'insv'])
const AUDIO = new Set(['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'aiff'])
const DESIGN = new Set(['psd', 'psb', 'ai', 'eps', 'sketch', 'fig', 'xd', 'cdr', 'hdr', 'exr', 'svg'])
const DOC = new Set(['pdf', 'doc', 'docx', 'dot', 'dotx', 'docm', 'dotm', 'wps', 'wpt', 'rtf', 'html', 'htm', 'ppt', 'pptx', 'pptm', 'ppsx', 'ppsm', 'pps', 'potx', 'potm', 'dpt', 'dps', 'xmind', 'xls', 'xlt', 'xlsx', 'xlsm', 'xltx', 'xltm', 'et', 'csv', 'txt', 'md', 'markdown', 'pages', 'numbers', 'keynote', 'epub'])
const THREE_D = new Set(['obj', 'ply', '3ds', 'gltf', 'glb', 'fbx', 'stl', 'c4d', 'stp', 'step', 'iges', 'igs', '3dm', 'rhino', 'blend'])
const FONT = new Set(['ttf', 'otf', 'ttc', 'woff', 'woff2'])
const ARCHIVE = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'])

const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff',
  tiff: 'image/tiff', bmp: 'image/bmp', avif: 'image/avif', svg: 'image/svg+xml',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', flv: 'video/x-flv', mpg: 'video/mpeg',
  mpeg: 'video/mpeg', ts: 'video/mp2t',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
  flac: 'audio/flac', ogg: 'audio/ogg', aiff: 'audio/aiff',
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv',
  html: 'text/html', htm: 'text/html', rtf: 'application/rtf',
  ttf: 'font/ttf', otf: 'font/otf', ttc: 'font/collection', woff: 'font/woff', woff2: 'font/woff2',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed'
}

function kindFor(ext) {
  if (IMAGE.has(ext)) return 'image'
  if (VIDEO.has(ext)) return 'video'
  if (AUDIO.has(ext)) return 'audio'
  if (DESIGN.has(ext)) return 'design'
  if (DOC.has(ext)) return 'doc'
  if (THREE_D.has(ext)) return '3d'
  if (FONT.has(ext)) return 'font'
  if (ARCHIVE.has(ext)) return 'archive'
  return 'other'
}

function mimeFor(ext) {
  return MIME[ext] || 'application/octet-stream'
}

function withinDataDir(filePath) {
  const root = store.getDataDir()
  if (!root) return false
  const resolved = path.resolve(filePath)
  return resolved === root || resolved.startsWith(`${root}${path.sep}`)
}

function safeFolderName(value) {
  return (
    String(value || '导入文件夹')
      .replace(/[\u0000-\u001f]/g, '')
      .slice(0, 120) || '导入文件夹'
  )
}

function ensureImportFolder(state, name, parentId, counters, spaceId) {
  const folderName = safeFolderName(name)
  const normalizedParent = parentId || null
  const existing = state.folders.find(
    (folder) =>
      folder.spaceId === spaceId &&
      (folder.parentId || null) === normalizedParent &&
      folder.name === folderName
  )
  if (existing) return existing.id

  const folder = {
    id: crypto.randomUUID(),
    name: folderName,
    parentId: normalizedParent,
    spaceId,
    createdAt: new Date().toISOString()
  }
  state.folders.push(folder)
  counters.created += 1
  return folder.id
}

/**
 * 将拖入 / 选择的路径转换为“文件 + 目标文件夹”列表。
 * - 文件：导入到 targetFolderId
 * - 文件夹：在 targetFolderId 下创建同名文件夹，递归保留目录结构
 * - 同名文件夹复用，避免重复导入同一项目时产生副本
 */
async function buildImportPlan(inputPaths, targetFolderId, spaceId) {
  const state = store.getState()
  const entries = []
  const seen = new Set()
  const counters = { created: 0 }

  function addFile(filePath, folderId) {
    const resolved = path.resolve(filePath)
    if (withinDataDir(resolved) || seen.has(resolved)) return
    seen.add(resolved)
    entries.push({ file: resolved, folderId })
    if (entries.length > 5000) throw new Error('单次最多导入 5000 个文件')
  }

  async function walk(directory, folderId, depth) {
    if (depth > 12) return
    let children = []
    try {
      children = await fsp.readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const child of children) {
      if (child.name.startsWith('.') || child.isSymbolicLink()) continue
      const full = path.join(directory, child.name)
      if (child.isDirectory()) {
        if (child.name.toLowerCase().endsWith('.app')) continue
        const childFolderId = ensureImportFolder(state, child.name, folderId, counters, spaceId)
        await walk(full, childFolderId, depth + 1)
      } else if (child.isFile()) {
        addFile(full, folderId)
      }
    }
  }

  for (const input of inputPaths) {
    const resolved = path.resolve(input)
    if (withinDataDir(resolved)) continue
    let stat
    try {
      stat = await fsp.lstat(resolved)
    } catch {
      continue
    }
    if (stat.isSymbolicLink()) continue
    if (stat.isDirectory()) {
      const base = path.basename(resolved)
      if (base.toLowerCase().endsWith('.app')) continue
      const rootFolderId = ensureImportFolder(state, base, targetFolderId, counters, spaceId)
      await walk(resolved, rootFolderId, 0)
    } else if (stat.isFile()) {
      addFile(resolved, targetFolderId)
    }
  }

  if (counters.created > 0) store.touch()
  return { entries, foldersCreated: counters.created }
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

let importChain = Promise.resolve()

function importPaths(inputPaths, folderId = null) {
  const run = importChain.then(() => doImport(inputPaths, folderId))
  importChain = run.catch(() => {})
  return run
}

async function doImport(inputPaths, folderId) {
  const cleanPaths = (Array.isArray(inputPaths) ? inputPaths : [])
    .filter((item) => typeof item === 'string' && item.length > 0 && item.length < 4096)
    .slice(0, 1000)
  if (!cleanPaths.length) {
    return {
      added: 0,
      duplicates: 0,
      linked: 0,
      errors: 0,
      total: 0,
      foldersCreated: 0,
      items: [],
      duplicateItems: []
    }
  }

  const state = store.getState()
  const spaceId = store.getActiveSpaceId()
  const targetFolder =
    folderId &&
    state.folders.some((folder) => folder.id === folderId && folder.spaceId === spaceId)
      ? folderId
      : null
  const { entries, foldersCreated } = await buildImportPlan(cleanPaths, targetFolder, spaceId)
  const spaceAssets = state.assets.filter((asset) => asset.spaceId === spaceId)
  const hashToAsset = new Map(spaceAssets.map((asset) => [asset.hash, asset]))
  const addedIds = []
  const addedItems = []
  const duplicateItems = []
  let duplicates = 0
  let linked = 0
  let errors = 0

  for (const entry of entries) {
    const file = entry.file
    try {
      const hash = await sha256File(file)
      const existing = hashToAsset.get(hash)
      if (existing) {
        duplicates += 1
        const linkFolderId = entry.folderId || null
        let linkedNow = false
        if (
          linkFolderId &&
          !existing.trashed &&
          existing.folderId !== linkFolderId &&
          !existing.linkedFolderIds.includes(linkFolderId)
        ) {
          existing.linkedFolderIds.push(linkFolderId)
          existing.updatedAt = new Date().toISOString()
          linkedNow = true
          linked += 1
        }
        if (duplicateItems.length < 100) {
          duplicateItems.push({
            name: path.basename(file),
            assetId: existing.id,
            folderId: existing.folderId || null,
            trashed: Boolean(existing.trashed),
            linked: linkedNow,
            linkedFolderId: linkedNow ? linkFolderId : null
          })
        }
        continue
      }
      const stat = await fsp.stat(file)
      const ext = path.extname(file).slice(1).toLowerCase()
      const id = crypto.randomUUID()
      const fileName = ext ? `${id}.${ext}` : id
      await fsp.copyFile(file, path.join(store.getDirs().files, fileName))

      const now = new Date().toISOString()
      state.assets.push({
        id,
        name: path.basename(file),
        ext,
        kind: kindFor(ext),
        mime: mimeFor(ext),
        size: stat.size,
        width: null,
        height: null,
        aspect: null,
        duration: null,
        hash,
        folderId: entry.folderId || null,
        linkedFolderIds: [],
        spaceId,
        note: '',
        tags: [],
        aiTags: [],
        colors: [],
        favorite: false,
        trashed: false,
        importedAt: now,
        updatedAt: now,
        previewPath: null,
        featurePath: null,
        status: 'processing',
        comments: []
      })
      hashToAsset.set(hash, state.assets[state.assets.length - 1])
      addedIds.push(id)
      addedItems.push({ id, sourcePath: file, name: path.basename(file) })
      store.touch()
    } catch (error) {
      console.error('[HyBrand] 导入失败', file, error)
      errors += 1
    }
  }

  for (const id of addedIds) enqueue(id)
  if (addedIds.length || foldersCreated || linked) store.touch()

  return {
    added: addedIds.length,
    duplicates,
    linked,
    errors,
    total: entries.length,
    foldersCreated,
    items: addedItems,
    duplicateItems
  }
}

const queue = []
const queued = new Set()
const CONCURRENCY = 2
let running = 0

function enqueue(id) {
  if (queued.has(id)) return
  queued.add(id)
  queue.push(id)
  pump()
}

function pump() {
  while (running < CONCURRENCY && queue.length) {
    const id = queue.shift()
    running += 1
    processOne(id)
      .catch((error) => {
        console.error('[HyBrand] 素材处理失败', id, error)
        const asset = store.getAsset(id)
        if (asset) {
          asset.status = 'failed'
          asset.updatedAt = new Date().toISOString()
          store.touch()
        }
      })
      .finally(() => {
        running -= 1
        queued.delete(id)
        pump()
      })
  }
}

function previewFiles(id) {
  const dir = store.getDirs().previews
  return [`${id}.png`, `${id}.jpg`, `${id}.vision.jpg`].map((name) => path.join(dir, name))
}

async function processOne(id) {
  const asset = store.getAsset(id)
  if (!asset) return

  const original = store.originalPath(asset)
  const previewDir = store.getDirs().previews
  const pngPath = path.join(previewDir, `${id}.png`)
  const jpgPath = path.join(previewDir, `${id}.jpg`)
  const visionPreviewPath = path.join(previewDir, `${id}.vision.jpg`)

  await Promise.allSettled(previewFiles(id).map((file) => fsp.rm(file, { force: true })))

  let quickPreviewOK = false
  try {
    await previews.createPreview(original, pngPath)
    quickPreviewOK = true
  } catch {
    // QuickLook 不支持时降级为类型图标
  }
  if (!store.getAsset(id)) {
    await cleanupPartial(id)
    return
  }

  let meta = null
  try {
    meta = await vision.analyze(original, visionPreviewPath)
  } catch {
    // 视频、设计文件等由预览图兜底分析
  }
  if (!store.getAsset(id)) {
    await cleanupPartial(id)
    return
  }

  let previewName = quickPreviewOK ? `${id}.png` : null
  let visionPreviewOK = false
  try {
    const stat = await fsp.stat(visionPreviewPath)
    visionPreviewOK = stat.size > 1024
  } catch {
    visionPreviewOK = false
  }

  if (visionPreviewOK) {
    try {
      await fsp.rename(visionPreviewPath, jpgPath)
      if (quickPreviewOK) await fsp.rm(pngPath, { force: true })
      previewName = `${id}.jpg`
    } catch {
      visionPreviewOK = false
    }
  } else {
    await fsp.rm(visionPreviewPath, { force: true }).catch(() => {})
  }

  if (!store.getAsset(id)) {
    await cleanupPartial(id)
    return
  }

  const previewOK = Boolean(previewName)
  const previewAbsForAnalysis = previewName ? path.join(previewDir, previewName) : null
  const previewKinds = new Set(['video', 'design', 'doc', 'image'])
  const needsPreviewAnalysis =
    previewOK &&
    previewKinds.has(asset.kind) &&
    (!meta || !meta.labels.length || !meta.featureBuffer)

  let previewAnalysis = null
  if (needsPreviewAnalysis) {
    try {
      previewAnalysis = await vision.analyze(previewAbsForAnalysis)
    } catch {
      // 分析失败不影响入库
    }
  }
  if (!store.getAsset(id)) {
    await cleanupPartial(id)
    return
  }

  const live = store.getAsset(id)
  if (!live) {
    await cleanupPartial(id)
    return
  }

  const labelSource =
    meta && meta.labels.length
      ? meta
      : previewAnalysis && previewAnalysis.labels.length
        ? previewAnalysis
        : null
  const colorSource = meta && meta.colors.length ? meta : previewAnalysis
  const analysisDims = meta && meta.width ? meta : previewAnalysis
  const featureBuffer =
    (meta && meta.featureBuffer) || (previewAnalysis && previewAnalysis.featureBuffer) || null

  let featurePath = null
  if (featureBuffer && featureBuffer.byteLength >= 16) {
    try {
      await fsp.writeFile(path.join(store.getDirs().features, `${id}.f32`), featureBuffer)
      featurePath = `${id}.f32`
    } catch {
      featurePath = null
    }
  }

  const srcWidth = analysisDims && analysisDims.width ? analysisDims.width : null
  const srcHeight = analysisDims && analysisDims.height ? analysisDims.height : null

  live.width = meta && meta.width ? meta.width : null
  live.height = meta && meta.height ? meta.height : null
  live.aspect = srcWidth && srcHeight ? Math.round((srcWidth / srcHeight) * 1000) / 1000 : null
  live.duration = meta && meta.duration ? Math.round(meta.duration * 100) / 100 : null
  live.colors = (colorSource && colorSource.colors ? colorSource.colors : []).slice(0, 3)
  live.aiTags = (labelSource ? labelSource.labels : []).slice(0, 8)
  live.previewPath = previewName
  live.featurePath = featurePath
  live.status = previewOK || labelSource || featureBuffer || meta ? 'ready' : 'failed'
  live.updatedAt = new Date().toISOString()

  similar.invalidate(id)
  store.touch()
}

async function cleanupPartial(id) {
  const targets = [...previewFiles(id), path.join(store.getDirs().features, `${id}.f32`)]
  await Promise.allSettled(targets.map((target) => fsp.rm(target, { force: true })))
  similar.invalidate(id)
}

async function removeAssetFiles(asset) {
  const targets = [
    store.originalPath(asset),
    store.featureFilePath(asset),
    ...previewFiles(asset.id)
  ]
  await Promise.allSettled(targets.filter(Boolean).map((target) => fsp.rm(target, { force: true })))
  similar.invalidate(asset.id)
}

function reanalyze(id) {
  const asset = store.getAsset(id)
  if (!asset) return false
  asset.status = 'processing'
  asset.updatedAt = new Date().toISOString()
  store.touch()
  enqueue(id)
  return true
}

function rebuildPreviews() {
  const spaceId = store.getActiveSpaceId()
  const assets = store
    .getState()
    .assets.filter((asset) => !asset.trashed && asset.spaceId === spaceId)
  for (const asset of assets) {
    asset.status = 'processing'
    enqueue(asset.id)
  }
  store.touch()
  return assets.length
}

function recoverPending() {
  const pending = store.getState().assets.filter(
    (asset) => asset.status === 'processing' && !asset.trashed
  )
  for (const asset of pending) enqueue(asset.id)
  return pending.length
}

function rebuildAITags() {
  const kinds = new Set(['image', 'video', 'design', 'doc'])
  const spaceId = store.getActiveSpaceId()
  const assets = store
    .getState()
    .assets.filter((asset) => !asset.trashed && asset.spaceId === spaceId && kinds.has(asset.kind))
  for (const asset of assets) {
    asset.status = 'processing'
    enqueue(asset.id)
  }
  store.touch()
  return assets.length
}

module.exports = {
  importPaths,
  enqueue,
  reanalyze,
  rebuildPreviews,
  rebuildAITags,
  recoverPending,
  removeAssetFiles,
  kindFor,
  mimeFor
}
