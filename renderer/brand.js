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

export const COLOR_CATEGORIES = [
  { value: 'primary', label: '主色' },
  { value: 'secondary', label: '辅助色' },
  { value: 'accent', label: '强调色' },
  { value: 'neutral', label: '中性色' },
  { value: 'background', label: '背景色' },
  { value: 'text', label: '文字色' }
]

export const COLOR_CATEGORY_LABELS = Object.fromEntries(
  COLOR_CATEGORIES.map((item) => [item.value, item.label])
)

export const FONT_WEIGHTS = [
  { value: 100, label: 'Thin 100' },
  { value: 200, label: 'ExtraLight 200' },
  { value: 300, label: 'Light 300' },
  { value: 400, label: 'Regular 400' },
  { value: 500, label: 'Medium 500' },
  { value: 600, label: 'SemiBold 600' },
  { value: 700, label: 'Bold 700' },
  { value: 800, label: 'ExtraBold 800' },
  { value: 900, label: 'Black 900' }
]

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

function linearChannel(value) {
  const channel = value / 255
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b)
}

export function contrastRatio(hexA, hexB) {
  const a = luminance(hexA)
  const b = luminance(hexB)
  const light = Math.max(a, b)
  const dark = Math.min(a, b)
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100
}

export function contrastInfo(hex) {
  const white = contrastRatio(hex, '#FFFFFF')
  const black = contrastRatio(hex, '#000000')
  return {
    white,
    black,
    whiteAA: white >= 4.5,
    whiteAAA: white >= 7,
    blackAA: black >= 4.5,
    blackAAA: black >= 7
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

function activeTypefaces(brand, assets) {
  const byId = assetMap(assets)
  return (brand?.typography || []).filter((entry) => usableFontAsset(byId.get(entry.assetId)))
}

export function primaryLogoVariant(brand, assets) {
  const byId = assetMap(assets)
  const variant = (brand?.logoVariants || []).find(
    (item) => item.role === 'primary' && usableLogoAsset(byId.get(item.assetId))
  )
  return variant ? { variant, asset: byId.get(variant.assetId) } : null
}

export function fontFamilies(brand, assets) {
  const byId = assetMap(assets)
  const groups = new Map()
  for (const entry of brand?.typography || []) {
    const asset = byId.get(entry.assetId) || null
    const family = entry.family || entry.name || '品牌字体'
    if (!groups.has(family)) groups.set(family, [])
    groups.get(family).push({
      entry,
      asset,
      available: usableFontAsset(asset),
      family
    })
  }
  return [...groups.entries()]
    .map(([name, variants]) => ({
      name,
      variants: variants.sort(
        (a, b) =>
          (a.entry.weight || 400) - (b.entry.weight || 400) ||
          a.entry.name.localeCompare(b.entry.name, 'zh-CN')
      )
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

export function resolveTypeface(brand, assets, typefaceId) {
  if (!typefaceId) return null
  const entry = (brand?.typography || []).find((item) => item.id === typefaceId)
  if (!entry) return null
  const asset = assetMap(assets).get(entry.assetId) || null
  return {
    id: entry.id,
    entry,
    asset,
    available: usableFontAsset(asset),
    family: asset ? `BrandFont-${asset.id}` : 'inherit',
    name: entry.name || entry.family || '未命名字体',
    familyName: entry.family || entry.name || '品牌字体',
    weight: entry.weight || 400
  }
}

export function typeScaleSteps(brand, assets) {
  const scale = brand?.typeScale || {}
  const base = Number.isFinite(Number(scale.base)) ? Number(scale.base) : 16
  const ratio = Number.isFinite(Number(scale.ratio)) ? Number(scale.ratio) : 1.25
  const hasSteps = scale.steps && typeof scale.steps === 'object'
  const active = activeTypefaces(brand, assets)
  const fallbackHeading =
    active.find((entry) => entry.role === 'heading') ||
    active.find((entry) => entry.role === 'brand') ||
    active[0] ||
    null
  const fallbackBody =
    active.find((entry) => entry.role === 'body') ||
    active.find((entry) => entry.role === 'brand') ||
    active[0] ||
    null

  return [
    {
      key: 'display',
      label: 'Display',
      power: 4,
      lineHeight: 1.1,
      role: 'heading',
      sample: brand?.name || '品牌标题'
    },
    { key: 'h1', label: 'H1', power: 3, lineHeight: 1.2, role: 'heading', sample: '一级标题' },
    { key: 'h2', label: 'H2', power: 2, lineHeight: 1.3, role: 'heading', sample: '二级标题' },
    { key: 'h3', label: 'H3', power: 1, lineHeight: 1.4, role: 'heading', sample: '三级标题' },
    {
      key: 'body',
      label: 'Body',
      power: 0,
      lineHeight: 1.6,
      role: 'body',
      sample: '正文示例：让品牌交付变得确定。'
    },
    {
      key: 'caption',
      label: 'Caption',
      power: -1,
      lineHeight: 1.4,
      role: 'body',
      sample: '注释与辅助信息'
    }
  ].map((step) => {
    const assignedId = hasSteps ? scale.steps[step.key]?.typefaceId : null
    const fallback = step.role === 'heading' ? fallbackHeading : fallbackBody
    const typeface = resolveTypeface(brand, assets, assignedId || (!hasSteps ? fallback?.id : null))
    return {
      ...step,
      size: Math.round(base * ratio ** step.power * 10) / 10,
      weight: typeface?.weight || 400,
      family: typeface?.family || 'inherit',
      fontName: typeface ? `${typeface.familyName} ${typeface.weight}` : '系统字体',
      typefaceId: typeface?.id || null
    }
  })
}

export function pairingsResolved(brand, assets) {
  return (brand?.pairings || []).map((pairing) => ({
    ...pairing,
    heading: resolveTypeface(brand, assets, pairing.headingTypefaceId),
    body: resolveTypeface(brand, assets, pairing.bodyTypefaceId)
  }))
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
    },
    {
      key: 'pairing',
      label: '标题 / 正文字体搭配',
      done: activeTypefaces.length > 0 && (source.pairings || []).some((pairing) => {
        const ids = new Set(activeTypefaces.map((entry) => entry.id))
        return ids.has(pairing.headingTypefaceId) && ids.has(pairing.bodyTypefaceId)
      }),
      required: false,
      action: { type: 'pairing' }
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
  if (activeTypefaces.length) {
    const activeIds = new Set(activeTypefaces.map((entry) => entry.id))
    const hasPairing = (source.pairings || []).some(
      (pairing) =>
        activeIds.has(pairing.headingTypefaceId) && activeIds.has(pairing.bodyTypefaceId)
    )
    if (!hasPairing) insights.push('添加一组标题/正文字体搭配，团队才知道怎么组合使用。')
    const steps = Object.values(source.typeScale?.steps || {})
    if (steps.length && steps.every((step) => !step.typefaceId)) {
      insights.push('字阶还没有绑定字体，当前展示的仍是系统字体。')
    }
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
