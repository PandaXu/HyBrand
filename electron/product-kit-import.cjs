const fs = require('node:fs')
const fsp = fs.promises
const path = require('node:path')
const crypto = require('node:crypto')
const store = require('./store.cjs')
const importer = require('./importer.cjs')

const PRODUCT_STATUSES = new Set(['concept', 'upcoming', 'active', 'archived'])
const COLOR_CATEGORIES = new Set(['primary', 'secondary', 'accent', 'neutral', 'background', 'text'])

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function resolveFile(root, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath) return null
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(root, relativePath)
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null
  }
  try {
    return fs.statSync(resolved).isFile() ? resolved : null
  } catch {
    return null
  }
}

function uniqueName(base, taken, fallback) {
  const clean = text(base, 80) || fallback
  if (!taken.has(clean)) return clean
  let index = 2
  let candidate = `${clean}（导入）`
  while (taken.has(candidate)) {
    candidate = `${clean}（导入 ${index}）`
    index += 1
  }
  return candidate
}

function uniqueFolderName(base, folders, spaceId) {
  const names = new Set(
    folders.filter((folder) => folder.spaceId === spaceId).map((folder) => folder.name)
  )
  const clean = text(base, 60) || '产品素材'
  if (!names.has(clean)) return clean
  let index = 2
  while (names.has(`${clean} ${index}`)) index += 1
  return `${clean} ${index}`
}

function normalizeColors(colors, warnings) {
  if (!Array.isArray(colors)) return []
  return colors
    .filter((color) => color && typeof color === 'object')
    .map((color) => {
      const hex = String(color.hex || '')
      if (!/^#[0-9a-f]{6}$/i.test(hex)) {
        warnings.push(`跳过无效产品色「${text(color.name, 40) || '未命名'}」`)
        return null
      }
      return {
        id: crypto.randomUUID(),
        name: text(color.name, 40) || '产品色',
        hex: hex.toUpperCase(),
        pantone: text(color.pantone, 40),
        category: COLOR_CATEGORIES.has(color.category) ? color.category : 'primary',
        usage: text(color.usage, 200)
      }
    })
    .filter(Boolean)
}

function matchTypeface(brand, assets, spaceId, descriptor, warnings, label) {
  if (!descriptor || typeof descriptor !== 'object') return null
  const activeIds = new Set(
    (brand.typography || [])
      .filter((entry) => {
        const asset = assets.find(
          (item) => item.id === entry.assetId && item.spaceId === spaceId
        )
        return asset && !asset.trashed && asset.kind === 'font'
      })
      .map((entry) => entry.id)
  )
  const candidates = (brand.typography || []).filter((entry) => activeIds.has(entry.id))
  const family = text(descriptor.family, 80)
  const name = text(descriptor.name, 80)
  const weight = Number(descriptor.weight) || 400
  const match =
    candidates.find(
      (entry) =>
        (entry.family || '') === family &&
        (entry.name || '') === name &&
        (entry.weight || 400) === weight
    ) ||
    candidates.find(
      (entry) => (entry.family || '') === family && (entry.weight || 400) === weight
    ) ||
    candidates.find(
      (entry) => (entry.name || '') === name && (entry.weight || 400) === weight
    ) ||
    null
  if (!match) {
    warnings.push(
      `${label}字体「${family || name || '未知'} ${weight}」未在当前品牌中找到，已改为继承品牌字体`
    )
    return null
  }
  return match.id
}

async function importProductManualFromDirectory(sourceDir) {
  const root = path.resolve(sourceDir)
  let manifest
  try {
    manifest = JSON.parse(await fsp.readFile(path.join(root, 'product.json'), 'utf8'))
  } catch {
    throw new Error('所选目录不是有效的产品手册：缺少 product.json')
  }
  if (manifest.app !== 'HyBrand' || manifest.kind !== 'product-manual') {
    throw new Error('该品牌包不是由 HyBrand 导出的产品手册')
  }
  const data = manifest.product
  if (!data || typeof data !== 'object') throw new Error('产品手册缺少产品数据')

  const warnings = []
  const state = store.getState()
  const space = store.getSpace()
  const spaceId = state.activeSpaceId
  const assetEntries = Array.isArray(manifest.assets) ? manifest.assets : []
  const files = []
  for (const entry of assetEntries) {
    if (!entry || typeof entry !== 'object') continue
    const file = resolveFile(root, entry.file)
    if (!file) {
      warnings.push(`素材「${text(entry.name, 120) || '未命名'}」文件缺失`)
      continue
    }
    files.push({ entry, file })
  }

  let folderId = null
  if (data.hasFolder || data.folderName || files.length) {
    const name = uniqueFolderName(
      data.folderName || `${text(data.name, 80) || '产品'} 素材`,
      state.folders,
      spaceId
    )
    const folder = {
      id: crypto.randomUUID(),
      name,
      parentId: null,
      spaceId,
      createdAt: new Date().toISOString()
    }
    state.folders.push(folder)
    folderId = folder.id
  }

  let imported = { added: 0, duplicates: 0, errors: 0, items: [] }
  if (files.length) {
    imported = await importer.importPaths(
      files.map((item) => item.file),
      folderId
    )
    if (imported.errors) {
      warnings.push(`${imported.errors} 个产品素材导入失败`)
    }
  }

  const sourceToAsset = new Map(
    (imported.items || []).map((item) => [path.resolve(item.sourcePath), item.id])
  )
  const logoEntry =
    assetEntries.find((entry) => entry && entry.role === 'logo') ||
    assetEntries.find((entry) => entry && entry.file === data.logoFile) ||
    null
  let logoAssetId = null
  if (logoEntry) {
    const logoFile = resolveFile(root, logoEntry.file)
    if (logoFile) {
      logoAssetId = sourceToAsset.get(path.resolve(logoFile)) || null
    }
    if (!logoAssetId && logoEntry.hash) {
      const candidates = state.assets.filter(
        (asset) =>
          asset.spaceId === spaceId &&
          !asset.trashed &&
          asset.hash === logoEntry.hash
      )
      const inFolder =
        folderId &&
        candidates.find(
          (asset) =>
            asset.folderId === folderId ||
            (asset.linkedFolderIds || []).includes(folderId)
        )
      logoAssetId = (inFolder || candidates[0])?.id || null
    }
    if (!logoAssetId) warnings.push('产品 Logo 未能导入，已留空')
  } else if (data.logoFile) {
    warnings.push('产品 Logo 文件缺失，已留空')
  }

  const brand = store.getBrand()
  const headingTypefaceId = matchTypeface(
    brand,
    state.assets,
    spaceId,
    data.headingTypeface,
    warnings,
    '标题'
  )
  const bodyTypefaceId = matchTypeface(
    brand,
    state.assets,
    spaceId,
    data.bodyTypeface,
    warnings,
    '正文'
  )

  const names = new Set(space.products.map((product) => product.name))
  const name = uniqueName(data.name, names, '导入产品')
  const now = new Date().toISOString()
  const product = {
    id: crypto.randomUUID(),
    name,
    tagline: text(data.tagline, 160),
    description: text(data.description, 2000),
    category: text(data.category, 40),
    status: PRODUCT_STATUSES.has(data.status) ? data.status : 'concept',
    launchDate: /^\d{4}-\d{2}-\d{2}$/.test(String(data.launchDate || ''))
      ? String(data.launchDate)
      : '',
    sku: text(data.sku, 60),
    logoAssetId,
    logoLabel: text(data.logoLabel, 80),
    logoMinWidth: text(data.logoMinWidth, 60),
    logoClearSpace: text(data.logoClearSpace, 80),
    logoNote: text(data.logoNote, 500),
    colors: normalizeColors(data.colors, warnings),
    headingTypefaceId,
    bodyTypefaceId,
    folderId,
    usage: text(data.usage, 5000),
    createdAt: now,
    updatedAt: now
  }
  space.products.push(product)
  store.touch()

  return {
    ok: true,
    productId: product.id,
    name: product.name,
    importedAssets: imported.added || 0,
    skippedDuplicates: imported.duplicates || 0,
    warnings
  }
}

module.exports = { importProductManualFromDirectory }
