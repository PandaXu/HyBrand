const { ipcMain, dialog, shell, BrowserWindow, app, clipboard } = require('electron')
const fs = require('node:fs')
const fsp = fs.promises
const path = require('node:path')
const crypto = require('node:crypto')
const os = require('node:os')
const store = require('./store.cjs')
const importer = require('./importer.cjs')
const previews = require('./previews.cjs')
const vision = require('./vision.cjs')
const similar = require('./similar.cjs')
const mediaProtocol = require('./media-protocol.cjs')
const brandExport = require('./brand-export.cjs')

function fail(message) {
  throw new Error(message)
}

function idsFrom(value, max = 5000) {
  if (!Array.isArray(value)) fail('参数错误')
  const ids = [...new Set(value.filter((item) => typeof item === 'string' && item.length < 100))]
  if (ids.length > max) fail(`一次最多操作 ${max} 个素材`)
  return ids
}

function cleanName(value, max = 120) {
  if (typeof value !== 'string') fail('名称无效')
  const name = value.trim()
  if (!name) fail('名称不能为空')
  if (name.length > max) fail(`名称不能超过 ${max} 个字符`)
  return name
}

function cleanTag(value) {
  if (typeof value !== 'string') fail('标签无效')
  const tag = value.trim()
  if (!tag || tag.length > 32) fail('标签需为 1-32 个字符')
  return tag
}

function cleanTags(value) {
  if (!Array.isArray(value)) fail('标签格式错误')
  const tags = [...new Set(value.map(cleanTag))].slice(0, 30)
  return tags
}

function validFolderId(value) {
  if (value === null || value === undefined || value === '') return null
  const folder = store.getState().folders.find((item) => item.id === value)
  return folder ? folder.id : null
}

function windowFor(event) {
  return BrowserWindow.fromWebContents(event.sender) || null
}

function registerIpc() {
  ipcMain.handle('library:load', () => store.snapshot())

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    dataDir: store.getDataDir()
  }))

  ipcMain.handle('import:pick', async (event, payload = {}) => {
    const win = windowFor(event)
    const result = await dialog.showOpenDialog(win, {
      title: '导入素材',
      buttonLabel: '导入',
      properties: ['openFile', 'multiSelections']
    })
    if (result.canceled || !result.filePaths.length) return null
    return importer.importPaths(result.filePaths, payload.folderId)
  })

  ipcMain.handle('import:paths', async (_event, payload = {}) => {
    const paths = Array.isArray(payload.paths) ? payload.paths.slice(0, 1000) : []
    if (!paths.length) return { added: 0, duplicates: 0, errors: 0, total: 0 }
    return importer.importPaths(paths, payload.folderId)
  })

  ipcMain.handle('asset:update', (_event, payload = {}) => {
    const asset = store.getAsset(payload.id)
    if (!asset) fail('素材不存在')
    const patch = payload.patch || {}

    if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
      asset.name = cleanName(patch.name, 255)
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'note')) {
      if (typeof patch.note !== 'string') fail('备注格式错误')
      asset.note = patch.note.slice(0, 5000)
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'folderId')) {
      asset.folderId = validFolderId(patch.folderId)
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'tags')) {
      asset.tags = cleanTags(patch.tags)
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'favorite')) {
      asset.favorite = Boolean(patch.favorite)
    }

    asset.updatedAt = new Date().toISOString()
    store.touch()
    return { ok: true }
  })

  ipcMain.handle('assets:batch', async (_event, payload = {}) => {
    const ids = idsFrom(payload.ids)
    const action = payload.action
    const state = store.getState()
    const targets = state.assets.filter((asset) => ids.includes(asset.id))
    const now = new Date().toISOString()
    let removedIds = []

    if (action === 'move') {
      const folderId = validFolderId(payload.value)
      for (const asset of targets) {
        asset.folderId = folderId
        asset.updatedAt = now
      }
    } else if (action === 'favorite' || action === 'unfavorite') {
      for (const asset of targets) {
        asset.favorite = action === 'favorite'
        asset.updatedAt = now
      }
    } else if (action === 'trash') {
      for (const asset of targets) {
        asset.trashed = true
        asset.updatedAt = now
      }
    } else if (action === 'restore') {
      for (const asset of targets) {
        asset.trashed = false
        asset.updatedAt = now
      }
    } else if (action === 'tag' || action === 'untag') {
      const tag = cleanTag(payload.value)
      for (const asset of targets) {
        if (action === 'tag') {
          if (!asset.tags.includes(tag)) asset.tags.push(tag)
        } else {
          asset.tags = asset.tags.filter((item) => item !== tag)
        }
        asset.updatedAt = now
      }
    } else if (action === 'deleteForever') {
      await Promise.all(targets.map((asset) => importer.removeAssetFiles(asset)))
      const removeSet = new Set(targets.map((asset) => asset.id))
      removedIds = [...removeSet]
      state.assets = state.assets.filter((asset) => !removeSet.has(asset.id))
      if (state.brand) {
        state.brand.logoVariants = state.brand.logoVariants.filter(
          (variant) => !removeSet.has(variant.assetId)
        )
        state.brand.typography = state.brand.typography.filter(
          (typeface) => !removeSet.has(typeface.assetId)
        )
        state.brand.updatedAt = now
      }
    } else {
      fail('未知的批量操作')
    }

    store.touch()
    return { count: targets.length, removedIds }
  })

  ipcMain.handle('folder:create', (_event, payload = {}) => {
    const name = cleanName(payload.name, 60)
    const parentId = validFolderId(payload.parentId)
    const folder = {
      id: crypto.randomUUID(),
      name,
      parentId,
      createdAt: new Date().toISOString()
    }
    store.getState().folders.push(folder)
    store.touch()
    return folder
  })

  ipcMain.handle('folder:rename', (_event, payload = {}) => {
    const folder = store.getState().folders.find((item) => item.id === payload.id)
    if (!folder) fail('文件夹不存在')
    folder.name = cleanName(payload.name, 60)
    store.touch()
    return folder
  })

  ipcMain.handle('folder:delete', (_event, payload = {}) => {
    const folder = store.getState().folders.find((item) => item.id === payload.id)
    if (!folder) fail('文件夹不存在')
    const state = store.getState()
    const descendants = store.folderDescendants(folder.id)
    const now = new Date().toISOString()
    let trashed = 0

    for (const asset of state.assets) {
      if (asset.folderId && descendants.has(asset.folderId)) {
        if (!asset.trashed) trashed += 1
        asset.trashed = true
        asset.folderId = null
        asset.updatedAt = now
      }
    }

    const removed = descendants.size
    state.folders = state.folders.filter((item) => !descendants.has(item.id))
    store.touch()
    return { trashed, removed }
  })

  ipcMain.handle('comments:add', (_event, payload = {}) => {
    const asset = store.getAsset(payload.assetId)
    if (!asset) fail('素材不存在')
    if (typeof payload.text !== 'string') fail('评论内容无效')
    const text = payload.text.trim()
    if (!text) fail('评论不能为空')
    if (text.length > 2000) fail('评论不能超过 2000 个字符')
    const comment = {
      id: crypto.randomUUID(),
      text,
      author: '我',
      createdAt: new Date().toISOString()
    }
    asset.comments.push(comment)
    asset.updatedAt = new Date().toISOString()
    store.touch()
    return comment
  })

  ipcMain.handle('comments:delete', (_event, payload = {}) => {
    const asset = store.getAsset(payload.assetId)
    if (!asset) fail('素材不存在')
    asset.comments = asset.comments.filter((comment) => comment.id !== payload.commentId)
    asset.updatedAt = new Date().toISOString()
    store.touch()
    return { ok: true }
  })

  ipcMain.handle('assets:similar', (_event, payload = {}) => {
    const asset = store.getAsset(payload.id)
    if (!asset) fail('素材不存在')
    const feature = similar.featureForAsset(asset.id)
    if (!feature) return { referenceId: asset.id, results: [] }
    return {
      referenceId: asset.id,
      results: similar.rank(feature, { excludeId: asset.id, limit: 200 })
    }
  })

  ipcMain.handle('search:image', async (event) => {
    const win = windowFor(event)
    const picked = await dialog.showOpenDialog(win, {
      title: '以图搜图',
      buttonLabel: '搜索',
      properties: ['openFile'],
      filters: [
        {
          name: '图片',
          extensions: ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif', 'tiff', 'tif', 'bmp', 'avif']
        }
      ]
    })
    if (picked.canceled || !picked.filePaths[0]) return null

    const source = picked.filePaths[0]
    let analysis
    try {
      analysis = await vision.analyze(source)
    } catch {
      fail('无法分析这张图片')
    }
    if (!analysis.featureBuffer) fail('这张图片无法提取视觉特征')

    const reference = similar.floatsFromBuffer(analysis.featureBuffer)
    const results = similar.rank(reference, { limit: 200 })

    let tempPath = path.join(os.tmpdir(), `hybrand-search-${crypto.randomUUID()}.png`)
    try {
      await previews.createPreview(source, tempPath)
    } catch {
      const ext = path.extname(source).toLowerCase() || '.png'
      const copyPath = path.join(os.tmpdir(), `hybrand-search-${crypto.randomUUID()}${ext}`)
      await fsp.copyFile(source, copyPath)
      tempPath = copyPath
    }

    return {
      token: mediaProtocol.addTempFile(tempPath),
      name: path.basename(source),
      results
    }
  })

  ipcMain.handle('search:clear-temp', (_event, payload = {}) => {
    if (typeof payload.token === 'string') mediaProtocol.clearTemp(payload.token)
    return { ok: true }
  })

  ipcMain.handle('asset:download', async (event, payload = {}) => {
    const asset = store.getAsset(payload.id)
    if (!asset) fail('素材不存在')
    const win = windowFor(event)
    const result = await dialog.showSaveDialog(win, {
      title: '下载素材',
      defaultPath: path.join(app.getPath('downloads'), asset.name),
      buttonLabel: '保存'
    })
    if (result.canceled || !result.filePath) return false
    await fsp.copyFile(store.originalPath(asset), result.filePath)
    return true
  })

  ipcMain.handle('asset:reveal', (_event, payload = {}) => {
    const asset = store.getAsset(payload.id)
    if (!asset) fail('素材不存在')
    shell.showItemInFolder(store.originalPath(asset))
    return true
  })

  ipcMain.handle('asset:open', async (_event, payload = {}) => {
    const asset = store.getAsset(payload.id)
    if (!asset) fail('素材不存在')
    const error = await shell.openPath(store.originalPath(asset))
    return { error }
  })

  ipcMain.handle('asset:reanalyze', (_event, payload = {}) => {
    return { ok: importer.reanalyze(payload.id) }
  })

  ipcMain.handle('maintenance:rebuild-previews', () => {
    return { count: importer.rebuildPreviews() }
  })

  ipcMain.handle('maintenance:rebuild-ai', () => {
    return { count: importer.rebuildAITags() }
  })


  // ---------- Brand space ----------

  function currentBrand() {
    const brand = store.getState().brand
    if (!brand) fail('品牌数据不可用')
    return brand
  }

  function cleanBrandText(value, max, label) {
    if (typeof value !== 'string') fail(`${label}格式错误`)
    return value.trim().slice(0, max)
  }

  function touchBrand() {
    const brand = currentBrand()
    brand.updatedAt = new Date().toISOString()
    store.touch()
    return brand
  }

  ipcMain.handle('brand:update-profile', (_event, payload = {}) => {
    const brand = currentBrand()
    if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
      brand.name = cleanBrandText(payload.name, 80, '品牌名称')
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'tagline')) {
      brand.tagline = cleanBrandText(payload.tagline, 160, '品牌定位')
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
      brand.description = cleanBrandText(payload.description, 2000, '品牌简介')
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'voice')) {
      brand.voice = cleanBrandText(payload.voice, 5000, '品牌语气')
    }
    touchBrand()
    return { ok: true }
  })

  ipcMain.handle('brand:save-logo', (_event, payload = {}) => {
    const brand = currentBrand()
    const asset = store.getAsset(payload.assetId)
    if (!asset || asset.trashed) fail('请选择一个可用素材')
    if (!['image', 'design', 'doc'].includes(asset.kind)) fail('Logo 需要图片或设计文件')
    const roles = ['primary', 'reverse', 'monochrome', 'horizontal', 'vertical', 'icon']
    const item = {
      id: payload.id || crypto.randomUUID(),
      assetId: asset.id,
      role: roles.includes(payload.role) ? payload.role : 'primary',
      label: cleanBrandText(payload.label || '', 80, 'Logo 名称'),
      minWidth: cleanBrandText(payload.minWidth || '', 60, '最小宽度'),
      clearSpace: cleanBrandText(payload.clearSpace || '', 80, '安全边距'),
      note: cleanBrandText(payload.note || '', 500, 'Logo 说明')
    }
    if (payload.id) {
      const index = brand.logoVariants.findIndex((variant) => variant.id === payload.id)
      if (index < 0) fail('Logo 变体不存在')
      brand.logoVariants[index] = item
    } else {
      brand.logoVariants.push(item)
    }
    touchBrand()
    return item
  })

  ipcMain.handle('brand:remove-logo', (_event, payload = {}) => {
    const brand = currentBrand()
    brand.logoVariants = brand.logoVariants.filter((variant) => variant.id !== payload.id)
    touchBrand()
    return { ok: true }
  })

  ipcMain.handle('brand:save-color', (_event, payload = {}) => {
    const brand = currentBrand()
    const hex = typeof payload.hex === 'string' ? payload.hex.trim() : ''
    if (!/^#[0-9a-f]{6}$/i.test(hex)) fail('请输入有效的 HEX 颜色')
    const item = {
      id: payload.id || crypto.randomUUID(),
      name: cleanBrandText(payload.name || '品牌色', 40, '颜色名称') || '品牌色',
      hex: hex.toUpperCase(),
      pantone: cleanBrandText(payload.pantone || '', 40, 'Pantone')
    }
    if (payload.id) {
      const index = brand.colors.findIndex((color) => color.id === payload.id)
      if (index < 0) fail('品牌色不存在')
      brand.colors[index] = item
    } else {
      brand.colors.push(item)
    }
    touchBrand()
    return item
  })

  ipcMain.handle('brand:remove-color', (_event, payload = {}) => {
    const brand = currentBrand()
    brand.colors = brand.colors.filter((color) => color.id !== payload.id)
    touchBrand()
    return { ok: true }
  })

  ipcMain.handle('brand:save-typeface', (_event, payload = {}) => {
    const brand = currentBrand()
    const asset = store.getAsset(payload.assetId)
    if (!asset || asset.trashed) fail('请选择一个可用字体文件')
    if (asset.kind !== 'font') fail('请选择一个字体文件')
    const roles = ['brand', 'heading', 'body']
    const item = {
      id: payload.id || crypto.randomUUID(),
      assetId: asset.id,
      role: roles.includes(payload.role) ? payload.role : 'brand',
      name: cleanBrandText(
        payload.name || asset.name.replace(/\.[^.]+$/, ''),
        80,
        '字体名称'
      ),
      note: cleanBrandText(payload.note || '', 500, '字体说明'),
      sample: cleanBrandText(payload.sample || '', 200, '字体示例')
    }
    if (payload.id) {
      const index = brand.typography.findIndex((typeface) => typeface.id === payload.id)
      if (index < 0) fail('字体不存在')
      brand.typography[index] = item
    } else {
      brand.typography.push(item)
    }
    touchBrand()
    return item
  })

  ipcMain.handle('brand:remove-typeface', (_event, payload = {}) => {
    const brand = currentBrand()
    brand.typography = brand.typography.filter((typeface) => typeface.id !== payload.id)
    touchBrand()
    return { ok: true }
  })

  ipcMain.handle('brand:export', async (event, payload = {}) => {
    const brand = currentBrand()
    let destination = null
    if (typeof payload.destination === 'string' && payload.destination) {
      destination = path.resolve(payload.destination)
      if (!fs.existsSync(destination) || !fs.statSync(destination).isDirectory()) {
        fail('导出目录不存在')
      }
    } else {
      const picked = await dialog.showOpenDialog(windowFor(event), {
        title: '导出品牌包',
        buttonLabel: '导出到这里',
        properties: ['openDirectory', 'createDirectory']
      })
      if (picked.canceled || !picked.filePaths[0]) return null
      destination = picked.filePaths[0]
    }
    const result = await brandExport.exportBrandKit({ destination })
    brand.lastExportedAt = new Date().toISOString()
    touchBrand()
    return result
  })

  ipcMain.handle('system:copy', (_event, payload = {}) => {
    clipboard.writeText(String(payload.text || '').slice(0, 20000))
    return true
  })

  ipcMain.handle('system:reveal-data', async () => {
    await shell.openPath(store.getDataDir())
    return true
  })
}

module.exports = { registerIpc }
