const fs = require('node:fs')
const fsp = fs.promises
const path = require('node:path')
const crypto = require('node:crypto')
const store = require('./store.cjs')
const importer = require('./importer.cjs')

const LOGO_ROLES = new Set(['primary', 'reverse', 'monochrome', 'horizontal', 'vertical', 'icon'])
const TYPE_ROLES = new Set(['brand', 'heading', 'body'])
const COLOR_CATEGORIES = new Set(['primary', 'secondary', 'accent', 'neutral', 'background', 'text'])
const FONT_WEIGHTS = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900])
const STEP_KEYS = ['display', 'h1', 'h2', 'h3', 'body', 'caption']
const HEADING_KEYS = new Set(['display', 'h1', 'h2', 'h3'])

function text(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function isInside(root, filePath) {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(filePath)
  return resolved === resolvedRoot || resolved.startsWith(`${resolvedRoot}${path.sep}`)
}

function resolveKitFile(root, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath) return null
  const resolved = path.resolve(root, relativePath)
  if (!isInside(root, resolved)) return null
  try {
    return fs.statSync(resolved).isFile() ? resolved : null
  } catch {
    return null
  }
}

function validHex(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function normalizeColors(colors, warnings) {
  if (!Array.isArray(colors)) return []
  return colors
    .filter((color) => color && typeof color === 'object')
    .map((color) => {
      if (!validHex(color.hex)) {
        warnings.push(`跳过无效品牌色「${text(color.name, 40) || '未命名'}」`)
        return null
      }
      return {
        id: crypto.randomUUID(),
        name: text(color.name, 40) || '品牌色',
        hex: color.hex.toUpperCase(),
        pantone: text(color.pantone, 40),
        category: COLOR_CATEGORIES.has(color.category) ? color.category : 'primary',
        usage: text(color.usage, 200)
      }
    })
    .filter(Boolean)
}

async function importBrandKitFromDirectory(sourceDir) {
  const root = path.resolve(sourceDir)
  const manifestPath = path.join(root, 'brand.json')
  let manifest
  try {
    manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'))
  } catch {
    throw new Error('所选目录不是有效的品牌包：缺少 brand.json')
  }
  if (manifest.app && manifest.app !== 'HyBrand') {
    throw new Error('该品牌包不是由 HyBrand 导出的')
  }
  const data = manifest.brand
  if (!data || typeof data !== 'object') {
    throw new Error('品牌包缺少品牌数据')
  }

  const warnings = []
  const filePaths = new Set()
  const logoEntries = []
  const typeEntries = []

  for (const variant of Array.isArray(data.logoVariants) ? data.logoVariants : []) {
    if (!variant || typeof variant !== 'object') continue
    const source = resolveKitFile(root, variant.file)
    if (!source) {
      warnings.push(`Logo「${text(variant.label, 80) || variant.role || '未命名'}」文件缺失`)
      continue
    }
    logoEntries.push({ variant, source })
    filePaths.add(source)
  }

  for (const entry of Array.isArray(data.typography) ? data.typography : []) {
    if (!entry || typeof entry !== 'object') continue
    const source = resolveKitFile(root, entry.file)
    if (!source) {
      warnings.push(`字体「${text(entry.name, 80) || '未命名'}」文件缺失`)
      continue
    }
    typeEntries.push({ entry, source })
    filePaths.add(source)
  }

  const space = store.createSpace(text(data.name, 80) || text(path.basename(root), 80) || '导入品牌')
  let imported = { added: 0, duplicates: 0, errors: 0, items: [] }
  if (filePaths.size) {
    try {
      imported = await importer.importPaths([...filePaths], null)
    } catch (error) {
      warnings.push(`品牌素材导入失败：${error.message}`)
    }
  }

  const bySource = new Map(
    (imported.items || []).map((item) => [path.resolve(item.sourcePath), item.id])
  )
  const assetIdFor = (source) => bySource.get(path.resolve(source)) || null

  const brand = store.getBrand()
  brand.name = text(data.name, 80) || space.name
  brand.tagline = text(data.tagline, 160)
  brand.description = text(data.description, 2000)
  brand.voice = text(data.voice, 5000)
  brand.colors = normalizeColors(data.colors, warnings)

  brand.logoVariants = logoEntries
    .map(({ variant, source }) => {
      const assetId = assetIdFor(source)
      if (!assetId) {
        warnings.push(`Logo「${text(variant.label, 80) || variant.role || '未命名'}」未能导入素材`)
        return null
      }
      return {
        id: crypto.randomUUID(),
        assetId,
        role: LOGO_ROLES.has(variant.role) ? variant.role : 'primary',
        label: text(variant.label, 80),
        minWidth: text(variant.minWidth, 60),
        clearSpace: text(variant.clearSpace, 80),
        note: text(variant.note, 500)
      }
    })
    .filter(Boolean)

  const sourceIdToNew = new Map()
  brand.typography = typeEntries
    .map(({ entry, source }) => {
      const assetId = assetIdFor(source)
      if (!assetId) {
        warnings.push(`字体「${text(entry.name, 80) || '未命名'}」未能导入素材`)
        return null
      }
      const id = crypto.randomUUID()
      if (entry.id) sourceIdToNew.set(String(entry.id), id)
      return {
        id,
        assetId,
        role: TYPE_ROLES.has(entry.role) ? entry.role : 'brand',
        family: text(entry.family, 80) || text(entry.name, 80) || '品牌字体',
        name: text(entry.name, 80),
        note: text(entry.note, 500),
        sample: text(entry.sample, 200),
        weight: FONT_WEIGHTS.has(Number(entry.weight)) ? Number(entry.weight) : 400
      }
    })
    .filter(Boolean)

  const heading =
    brand.typography.find((item) => item.role === 'heading') ||
    brand.typography.find((item) => item.role === 'brand') ||
    brand.typography[0] ||
    null
  const body =
    brand.typography.find((item) => item.role === 'body') ||
    brand.typography.find((item) => item.role === 'brand') ||
    brand.typography[0] ||
    null

  const rawSteps = data.typeScale?.steps || {}
  const steps = {}
  for (const key of STEP_KEYS) {
    let typefaceId = sourceIdToNew.get(String(rawSteps[key]?.typefaceId || '')) || null
    if (!typefaceId) {
      typefaceId = (HEADING_KEYS.has(key) ? heading?.id : body?.id) || null
    }
    steps[key] = { typefaceId }
  }
  brand.typeScale = {
    base: Number.isFinite(Number(data.typeScale?.base))
      ? Math.min(24, Math.max(10, Number(data.typeScale.base)))
      : 16,
    ratio: Number.isFinite(Number(data.typeScale?.ratio))
      ? Math.min(1.6, Math.max(1.05, Number(data.typeScale.ratio)))
      : 1.25,
    steps
  }

  brand.pairings = (Array.isArray(data.pairings) ? data.pairings : [])
    .map((pairing) => {
      if (!pairing || typeof pairing !== 'object') return null
      const headingId =
        sourceIdToNew.get(String(pairing.headingTypefaceId || '')) || heading?.id || null
      const bodyId =
        sourceIdToNew.get(String(pairing.bodyTypefaceId || '')) || body?.id || null
      if (!headingId || !bodyId) return null
      return {
        id: crypto.randomUUID(),
        name: text(pairing.name, 80) || '字体搭配',
        headingTypefaceId: headingId,
        bodyTypefaceId: bodyId,
        note: text(pairing.note, 1000)
      }
    })
    .filter(Boolean)

  brand.updatedAt = new Date().toISOString()
  space.name = brand.name || space.name
  store.touch()

  return {
    ok: true,
    spaceId: space.id,
    name: space.name,
    importedAssets: imported.added || 0,
    skippedDuplicates: imported.duplicates || 0,
    warnings
  }
}

module.exports = { importBrandKitFromDirectory }
