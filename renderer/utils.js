export const KIND_LABELS = {
  image: '图片',
  video: '视频',
  audio: '音频',
  design: '设计源文件',
  doc: '文档',
  '3d': '3D',
  font: '字体',
  archive: '压缩包',
  other: '其他'
}

export const KIND_ORDER = ['image', 'video', 'audio', 'design', 'doc', '3d', 'font', 'archive', 'other']

export const SORT_OPTIONS = [
  { value: 'imported-desc', label: '最新导入' },
  { value: 'imported-asc', label: '最早导入' },
  { value: 'updated-desc', label: '最近修改' },
  { value: 'name-asc', label: '名称 A → Z' },
  { value: 'size-desc', label: '文件大小' },
  { value: 'kind-asc', label: '文件类型' }
]

export const COLOR_FILTERS = [
  { key: 'red', label: '红', hex: '#E5484D' },
  { key: 'orange', label: '橙', hex: '#F76B15' },
  { key: 'yellow', label: '黄', hex: '#F5C518' },
  { key: 'green', label: '绿', hex: '#30A46C' },
  { key: 'cyan', label: '青', hex: '#12A594' },
  { key: 'blue', label: '蓝', hex: '#3E63DD' },
  { key: 'purple', label: '紫', hex: '#7C5CFF' },
  { key: 'pink', label: '粉', hex: '#E93D82' },
  { key: 'neutral', label: '黑白', hex: '#8B8D98' }
]

const BROWSER_IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp'])
const BROWSER_VIDEO = new Set(['mp4', 'webm', 'm4v'])
const BROWSER_AUDIO = new Set(['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'])

export function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size >= 100 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`
}

export function formatDate(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDuration(seconds) {
  if (!seconds || !Number.isFinite(seconds)) return ''
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function aspectOf(asset) {
  if (asset && Number.isFinite(asset.aspect) && asset.aspect > 0) return asset.aspect
  if (asset && asset.width && asset.height) return asset.width / asset.height
  return 1
}

export function dimensionsOf(asset) {
  if (asset && asset.width && asset.height) return `${asset.width} × ${asset.height}`
  return '—'
}

export function isBrowserImage(ext) {
  return BROWSER_IMAGE.has(String(ext || '').toLowerCase())
}
export function isBrowserVideo(ext) {
  return BROWSER_VIDEO.has(String(ext || '').toLowerCase())
}
export function isBrowserAudio(ext) {
  return BROWSER_AUDIO.has(String(ext || '').toLowerCase())
}

export function assetUrl(asset) {
  return `hybrand://asset/${asset.id}`
}
export function previewUrl(asset) {
  if (!asset || !asset.previewPath) return null
  return `hybrand://preview/${asset.id}?v=${encodeURIComponent(asset.updatedAt || '')}`
}
export function cardImage(asset) {
  if (!asset) return null
  if (asset.kind === 'image' && isBrowserImage(asset.ext)) return assetUrl(asset)
  return previewUrl(asset)
}
export function largeImage(asset) {
  if (!asset) return null
  if (asset.kind === 'image' && isBrowserImage(asset.ext)) return assetUrl(asset)
  return previewUrl(asset)
}

export function extLabel(asset) {
  return String(asset.ext || '').toUpperCase() || 'FILE'
}

export function aiTagName(tag) {
  if (!tag) return ''
  return tag.zh || String(tag.label || '').replace(/_/g, ' ')
}

export function colorKey(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return null
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (l < 0.12 || l > 0.93 || s < 0.12) return 'neutral'
  let h = 0
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  if (h < 0) h += 360
  if (h < 15 || h >= 345) return 'red'
  if (h < 40) return 'orange'
  if (h < 68) return 'yellow'
  if (h < 165) return 'green'
  if (h < 195) return 'cyan'
  if (h < 260) return 'blue'
  if (h < 290) return 'purple'
  return 'pink'
}

export function emptyFilters() {
  return {
    kinds: [],
    colors: [],
    tags: [],
    tagMode: 'any',
    shape: null,
    date: 'all',
    favorite: false
  }
}

export function hasActiveFilters(filters) {
  return Boolean(
    filters &&
      (filters.kinds.length ||
        filters.colors.length ||
        filters.tags.length ||
        filters.shape ||
        filters.date !== 'all' ||
        filters.favorite)
  )
}

export function folderPath(folders, folderId) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const path = []
  let current = folderId ? byId.get(folderId) : null
  const guard = new Set()
  while (current && !guard.has(current.id)) {
    guard.add(current.id)
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : null
  }
  return path
}

export function flatFolders(folders) {
  const byParent = new Map()
  for (const folder of folders) {
    const key = folder.parentId || ''
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(folder)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }
  const result = []
  function walk(parentId, depth) {
    const list = byParent.get(parentId || '') || []
    for (const folder of list) {
      result.push({ ...folder, depth })
      walk(folder.id, depth + 1)
    }
  }
  walk('', 0)
  return result
}

export function descendantFolderIds(folders, folderId) {
  const result = new Set([folderId])
  let changed = true
  while (changed) {
    changed = false
    for (const folder of folders) {
      if (folder.parentId && result.has(folder.parentId) && !result.has(folder.id)) {
        result.add(folder.id)
        changed = true
      }
    }
  }
  return result
}

export function normalizeQuery(value) {
  return String(value || '').trim().toLowerCase()
}

export function matchesQuery(asset, query, aiName = aiTagName) {
  if (!query) return true
  if (String(asset.name || '').toLowerCase().includes(query)) return true
  if (String(asset.note || '').toLowerCase().includes(query)) return true
  if (asset.tags.some((tag) => String(tag).toLowerCase().includes(query))) return true
  if (asset.aiTags.some((tag) => {
    const name = aiName(tag).toLowerCase()
    return name.includes(query) || String(tag.label || '').toLowerCase().includes(query)
  })) return true
  return false
}

function matchTag(asset, tag) {
  if (asset.tags.includes(tag)) return true
  return asset.aiTags.some((item) => aiTagName(item) === tag)
}

export function matchesFilters(asset, filters) {
  if (!filters) return true
  if (filters.kinds.length && !filters.kinds.includes(asset.kind)) return false
  if (filters.favorite && !asset.favorite) return false
  if (filters.colors.length) {
    const key = asset.colors && asset.colors[0] ? colorKey(asset.colors[0]) : null
    if (!key || !filters.colors.includes(key)) return false
  }
  if (filters.shape) {
    const aspect = aspectOf(asset)
    if (filters.shape === 'landscape' && aspect < 1) return false
    if (filters.shape === 'portrait' && aspect >= 1) return false
  }
  if (filters.date !== 'all') {
    const days = filters.date === '7d' ? 7 : filters.date === '30d' ? 30 : 365
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    if (new Date(asset.importedAt).getTime() < cutoff) return false
  }
  if (filters.tags.length) {
    const matched = filters.tags.filter((tag) => matchTag(asset, tag))
    if (filters.tagMode === 'all') {
      if (matched.length !== filters.tags.length) return false
    } else if (!matched.length) {
      return false
    }
  }
  return true
}

export function sortAssets(assets, sort) {
  const list = [...assets]
  const byName = (a, b) => a.name.localeCompare(b.name, 'zh-CN')
  const comparators = {
    'imported-desc': (a, b) => String(b.importedAt).localeCompare(String(a.importedAt)),
    'imported-asc': (a, b) => String(a.importedAt).localeCompare(String(b.importedAt)),
    'updated-desc': (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
    'name-asc': byName,
    'size-desc': (a, b) => (b.size || 0) - (a.size || 0),
    'kind-asc': (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || byName(a, b)
  }
  list.sort(comparators[sort] || comparators['imported-desc'])
  return list
}

export function deriveView({ library, nav, search, filters, similar, sort }) {
  const assets = library.assets || []
  const folders = library.folders || []
  const active = assets.filter((asset) => !asset.trashed)

  const counts = {
    all: active.length,
    uncategorized: active.filter((asset) => !asset.folderId).length,
    favorites: active.filter((asset) => asset.favorite).length,
    trash: assets.length - active.length
  }

  const countsByFolder = new Map()
  const folderById = new Map(folders.map((folder) => [folder.id, folder]))
  for (const asset of active) {
    let folder = asset.folderId ? folderById.get(asset.folderId) : null
    const guard = new Set()
    while (folder && !guard.has(folder.id)) {
      guard.add(folder.id)
      countsByFolder.set(folder.id, (countsByFolder.get(folder.id) || 0) + 1)
      folder = folder.parentId ? folderById.get(folder.parentId) : null
    }
  }

  let base
  if (similar) {
    const byId = new Map(assets.map((asset) => [asset.id, asset]))
    const scope = similar.scopeFolderId
      ? descendantFolderIds(folders, similar.scopeFolderId)
      : null
    base = similar.results
      .map((result) => byId.get(result.id))
      .filter(
        (asset) =>
          asset &&
          !asset.trashed &&
          (!scope || (asset.folderId && scope.has(asset.folderId)))
      )
  } else if (nav.type === 'trash') {
    base = assets.filter((asset) => asset.trashed)
  } else if (nav.type === 'favorites') {
    base = active.filter((asset) => asset.favorite)
  } else if (nav.type === 'uncategorized') {
    base = active.filter((asset) => !asset.folderId)
  } else if (nav.type === 'folder') {
    base = active.filter((asset) => asset.folderId === nav.id)
  } else {
    base = active
  }

  const query = normalizeQuery(search)
  let list = base.filter((asset) => matchesQuery(asset, query) && matchesFilters(asset, filters))
  if (!similar) list = sortAssets(list, sort)

  const tagCounts = new Map()
  const manualCounts = new Map()
  const colorCounts = new Map()
  const kindCounts = new Map()
  for (const asset of active) {
    kindCounts.set(asset.kind, (kindCounts.get(asset.kind) || 0) + 1)
    const color = asset.colors && asset.colors[0] ? colorKey(asset.colors[0]) : null
    if (color) colorCounts.set(color, (colorCounts.get(color) || 0) + 1)
    const seen = new Set()
    for (const tag of asset.tags) {
      manualCounts.set(tag, (manualCounts.get(tag) || 0) + 1)
      if (!seen.has(tag)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
        seen.add(tag)
      }
    }
    for (const tag of asset.aiTags) {
      const name = aiTagName(tag)
      if (!name || seen.has(name)) continue
      seen.add(name)
      tagCounts.set(name, (tagCounts.get(name) || 0) + 1)
    }
  }

  const tagOptions = [...tagCounts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'zh-CN'))
    .slice(0, 300)
  const manualTags = [...manualCounts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'zh-CN'))
    .slice(0, 12)

  let childFolders = []
  if (!similar && !query && !hasActiveFilters(filters)) {
    if (nav.type === 'all') childFolders = folders.filter((folder) => !folder.parentId)
    else if (nav.type === 'folder') childFolders = folders.filter((folder) => folder.parentId === nav.id)
    childFolders = [...childFolders].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  return {
    assets: list,
    counts,
    countsByFolder,
    childFolders,
    tagOptions,
    manualTags,
    colorCounts,
    kindCounts
  }
}
