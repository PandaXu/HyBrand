export const LOGO_ROLES = [
  { value: 'primary', label: '主 Logo' },
  { value: 'reverse', label: '反白 Logo' },
  { value: 'monochrome', label: '单色 Logo' },
  { value: 'horizontal', label: '横版 Logo' },
  { value: 'vertical', label: '竖版 Logo' },
  { value: 'icon', label: '图标' }
]

export const TYPE_ROLES = [
  { value: 'brand', label: '品牌字体' },
  { value: 'heading', label: '标题字体' },
  { value: 'body', label: '正文字体' }
]

export const LOGO_ROLE_LABELS = Object.fromEntries(
  LOGO_ROLES.map((item) => [item.value, item.label])
)

export const TYPE_ROLE_LABELS = Object.fromEntries(
  TYPE_ROLES.map((item) => [item.value, item.label])
)

export function hexToRgb(hex) {
  const value = /^#[0-9a-f]{6}$/i.test(String(hex)) ? String(hex) : '#5B6CFF'
  return {
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16)
  }
}

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / d + 2)
    else h = 60 * ((rn - gn) / d + 4)
  }
  if (h < 0) h += 360
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

export function rgbToCmyk({ r, g, b }) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const k = 1 - Math.max(rn, gn, bn)
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
  return {
    c: Math.round(((1 - rn - k) / (1 - k)) * 100),
    m: Math.round(((1 - gn - k) / (1 - k)) * 100),
    y: Math.round(((1 - bn - k) / (1 - k)) * 100),
    k: Math.round(k * 100)
  }
}

export function colorValues(hex) {
  const rgb = hexToRgb(hex)
  const hsl = rgbToHsl(rgb)
  const cmyk = rgbToCmyk(rgb)
  return {
    hex: String(hex).toUpperCase(),
    rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    hsl: `${hsl.h}°, ${hsl.s}%, ${hsl.l}%`,
    cmyk: `${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%`
  }
}

function assetMap(assets) {
  return new Map((assets || []).map((asset) => [asset.id, asset]))
}

function usableLogoAsset(asset) {
  return Boolean(
    asset &&
      !asset.trashed &&
      ['image', 'design', 'doc'].includes(asset.kind)
  )
}

function usableFontAsset(asset) {
  return Boolean(asset && !asset.trashed && asset.kind === 'font')
}

export function primaryLogoVariant(brand, assets) {
  const byId = assetMap(assets)
  const variant = (brand?.logoVariants || []).find(
    (item) => item.role === 'primary' && usableLogoAsset(byId.get(item.assetId))
  )
  return variant ? { variant, asset: byId.get(variant.assetId) } : null
}

export function brandCompletion(brand, assets) {
  const source = brand || {}
  const byId = assetMap(assets)
  const logoVariants = source.logoVariants || []
  const colors = source.colors || []
  const typography = source.typography || []

  const activeLogos = logoVariants.filter((item) => usableLogoAsset(byId.get(item.assetId)))
  const activeTypefaces = typography.filter((item) =>
    usableFontAsset(byId.get(item.assetId))
  )
  const primary = activeLogos.find((item) => item.role === 'primary') || null

  const items = [
    {
      key: 'name',
      label: '品牌名称',
      done: Boolean(String(source.name || '').trim()),
      required: true,
      action: { type: 'profile' }
    },
    {
      key: 'primary-logo',
      label: '主 Logo',
      done: Boolean(primary),
      required: true,
      action: { type: 'logo', role: 'primary' }
    },
    {
      key: 'colors',
      label: '至少 1 个品牌色',
      done: colors.length > 0,
      required: true,
      action: { type: 'color' }
    },
    {
      key: 'typeface',
      label: '至少 1 套品牌字体',
      done: activeTypefaces.length > 0,
      required: true,
      action: { type: 'typeface' }
    },
    {
      key: 'voice',
      label: '品牌语气',
      done: Boolean(String(source.voice || '').trim()),
      required: true,
      action: { type: 'profile' }
    },
    {
      key: 'tagline',
      label: '一句话品牌定位',
      done: Boolean(String(source.tagline || '').trim()),
      required: false,
      action: { type: 'profile' }
    },
    {
      key: 'description',
      label: '品牌简介',
      done: Boolean(String(source.description || '').trim()),
      required: false,
      action: { type: 'profile' }
    },
    {
      key: 'reverse-logo',
      label: '反白 Logo',
      done: activeLogos.some((item) => item.role === 'reverse'),
      required: false,
      action: { type: 'logo', role: 'reverse' }
    },
    {
      key: 'mono-logo',
      label: '单色 Logo',
      done: activeLogos.some((item) => item.role === 'monochrome'),
      required: false,
      action: { type: 'logo', role: 'monochrome' }
    },
    {
      key: 'colors-3',
      label: '至少 3 个品牌色',
      done: colors.length >= 3,
      required: false,
      action: { type: 'color' }
    },
    {
      key: 'typefaces-2',
      label: '标题 / 正文字体各一套',
      done: activeTypefaces.length >= 2,
      required: false,
      action: { type: 'typeface' }
    },
    {
      key: 'logo-rules',
      label: '主 Logo 使用规则',
      done: Boolean(primary && (primary.minWidth || primary.clearSpace)),
      required: false,
      action: { type: 'logo-edit', variantId: primary?.id || null }
    }
  ]

  const requiredItems = items.filter((item) => item.required)
  const recommendedItems = items.filter((item) => !item.required)
  const totalWeight = requiredItems.length + recommendedItems.length * 0.5
  const doneWeight =
    requiredItems.filter((item) => item.done).length +
    recommendedItems.filter((item) => item.done).length * 0.5
  const score = totalWeight ? Math.round((doneWeight / totalWeight) * 100) : 0

  const insights = []
  if (!String(source.name || '').trim()) {
    insights.push('先填写品牌名称，品牌手册才有主标题。')
  }
  if (!primary) {
    insights.push('还没有主 Logo，先为品牌指定一个官方版本。')
  } else {
    const primaryAsset = byId.get(primary.assetId)
    if (primaryAsset && String(primaryAsset.ext).toLowerCase() !== 'svg') {
      insights.push('主 Logo 不是 SVG，建议补充矢量版本。')
    }
    if (!primary.minWidth && !primary.clearSpace) {
      insights.push('主 Logo 缺少最小尺寸或安全边距说明。')
    }
  }
  if (!activeLogos.some((item) => item.role === 'reverse')) {
    insights.push('还没有反白 Logo，深色背景上容易用错。')
  }
  if (colors.length < 3) {
    insights.push('品牌色不足 3 个，建议补充辅助色。')
  }
  if (activeTypefaces.length < 2) {
    insights.push('字体少于两套，建议补充标题或正文字体。')
  }
  if (!String(source.voice || '').trim()) {
    insights.push('补充品牌语气，帮助团队统一表达。')
  }

  return {
    score,
    items,
    insights: insights.slice(0, 4),
    requiredDone: requiredItems.filter((item) => item.done).length,
    requiredTotal: requiredItems.length
  }
}

export function brandAssetFor(brand, item, assets) {
  const asset = assetMap(assets).get(item?.assetId)
  return asset && !asset.trashed ? asset : null
}
