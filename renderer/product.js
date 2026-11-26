import { cardImage, descendantFolderIds } from './utils.js'
import { resolveTypeface } from './brand.js'

export const PRODUCT_STATUSES = [
  { value: 'concept', label: '概念' },
  { value: 'upcoming', label: '待上市' },
  { value: 'active', label: '在售' },
  { value: 'archived', label: '已归档' }
]

export const PRODUCT_STATUS_LABELS = Object.fromEntries(
  PRODUCT_STATUSES.map((item) => [item.value, item.label])
)

export function productStatusLabel(status) {
  return PRODUCT_STATUS_LABELS[status] || '概念'
}

function byAssetId(assets) {
  return new Map((assets || []).map((asset) => [asset.id, asset]))
}

export function productLogo(product, assets) {
  const asset = product?.logoAssetId ? byAssetId(assets).get(product.logoAssetId) : null
  return {
    asset,
    available: Boolean(asset && !asset.trashed),
    src: asset && !asset.trashed ? cardImage(asset) : null
  }
}

export function productFolderAssets(product, assets, folders) {
  if (!product?.folderId) return []
  const scope = descendantFolderIds(folders, product.folderId)
  if (!scope) return []
  const seen = new Set()
  const result = []
  for (const asset of assets || []) {
    if (asset.trashed || seen.has(asset.id)) continue
    const inFolder =
      (asset.folderId && scope.has(asset.folderId)) ||
      (asset.linkedFolderIds || []).some((id) => scope.has(id))
    if (!inFolder) continue
    seen.add(asset.id)
    result.push(asset)
  }
  return result.sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt)))
}

function activeTypefaceEntries(brand, assets) {
  const byId = byAssetId(assets)
  return (brand?.typography || []).filter((entry) => {
    const asset = byId.get(entry.assetId)
    return asset && !asset.trashed && asset.kind === 'font'
  })
}

function fallbackTypeface(brand, assets, role) {
  const active = activeTypefaceEntries(brand, assets)
  const steps = brand?.typeScale?.steps || {}
  const stepId = role === 'heading' ? steps.h1?.typefaceId : steps.body?.typefaceId
  const step = resolveTypeface(brand, assets, stepId)
  if (step?.available) return step
  const entry =
    active.find((item) => item.role === role) ||
    active.find((item) => item.role === 'brand') ||
    active[0] ||
    null
  return entry ? resolveTypeface(brand, assets, entry.id) : null
}

export function productTypefaces(product, brand, assets) {
  const headingSelected = resolveTypeface(brand, assets, product?.headingTypefaceId)
  const bodySelected = resolveTypeface(brand, assets, product?.bodyTypefaceId)
  const heading = headingSelected?.available
    ? headingSelected
    : fallbackTypeface(brand, assets, 'heading')
  const body = bodySelected?.available ? bodySelected : fallbackTypeface(brand, assets, 'body')
  return {
    heading,
    body,
    headingInherited: !(headingSelected?.available),
    bodyInherited: !(bodySelected?.available),
    available: Boolean(heading || body)
  }
}

export function productAssetsCount(product, assets, folders) {
  return productFolderAssets(product, assets, folders).length
}

export function productCompletion(product, brand, assets, folders) {
  const source = product || {}
  const logo = productLogo(source, assets)
  const colors = source.colors || []
  const folderAssets = productFolderAssets(source, assets, folders)
  const typefaces = productTypefaces(source, brand, assets)
  const hasTypefaces = Boolean(typefaces.heading && typefaces.body)

  const items = [
    {
      key: 'name',
      label: '产品名称',
      done: Boolean(String(source.name || '').trim()),
      required: true,
      action: { type: 'profile' }
    },
    {
      key: 'description',
      label: '产品简介',
      done: Boolean(String(source.description || '').trim()),
      required: true,
      action: { type: 'profile' }
    },
    {
      key: 'logo',
      label: '产品 Logo',
      done: logo.available,
      required: true,
      action: { type: 'logo' }
    },
    {
      key: 'colors',
      label: '至少 1 个产品色',
      done: colors.length > 0,
      required: true,
      action: { type: 'color' }
    },
    {
      key: 'usage',
      label: '产品使用规范',
      done: Boolean(String(source.usage || '').trim()),
      required: true,
      action: { type: 'profile' }
    },
    {
      key: 'tagline',
      label: '一句话产品定位',
      done: Boolean(String(source.tagline || '').trim()),
      required: false,
      action: { type: 'profile' }
    },
    {
      key: 'category',
      label: '产品分类',
      done: Boolean(String(source.category || '').trim()),
      required: false,
      action: { type: 'profile' }
    },
    {
      key: 'sku',
      label: '产品编号 / SKU',
      done: Boolean(String(source.sku || '').trim()),
      required: false,
      action: { type: 'profile' }
    },
    {
      key: 'launch-date',
      label: '上市日期',
      done: Boolean(source.launchDate),
      required: false,
      action: { type: 'profile' }
    },
    {
      key: 'colors-3',
      label: '至少 3 个产品色',
      done: colors.length >= 3,
      required: false,
      action: { type: 'color' }
    },
    {
      key: 'logo-rules',
      label: '产品 Logo 使用规则',
      done: Boolean(source.logoMinWidth || source.logoClearSpace),
      required: false,
      action: { type: 'logo' }
    },
    {
      key: 'fonts',
      label: '标题 / 正文字体',
      done: hasTypefaces,
      required: false,
      action: { type: 'typefaces' }
    },
    {
      key: 'folder',
      label: '关联产品素材文件夹',
      done: Boolean(source.folderId && folderAssets.length),
      required: false,
      action: { type: 'profile' }
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
  if (!String(source.description || '').trim()) {
    insights.push('补充产品简介，说明它为谁解决什么问题。')
  }
  if (!logo.available) {
    insights.push('还没有产品 Logo，先指定一个官方标识。')
  } else if (!source.logoMinWidth && !source.logoClearSpace) {
    insights.push('产品 Logo 缺少最小尺寸或安全边距说明。')
  }
  if (!colors.length) {
    insights.push('添加产品色，避免不同渠道用色不一致。')
  } else if (colors.length < 3) {
    insights.push('产品色不足 3 个，建议补充辅助色。')
  }
  if (!String(source.usage || '').trim()) {
    insights.push('补充产品使用规范，写清楚包装、图片和文案的禁区。')
  }
  if (!source.folderId) {
    insights.push('关联一个产品素材文件夹，团队可以直接找到对应素材。')
  }
  if (!hasTypefaces) {
    insights.push('品牌字体库还没有可用字体，先到品牌手册补齐。')
  }

  return {
    score,
    items,
    insights: insights.slice(0, 4),
    requiredDone: requiredItems.filter((item) => item.done).length,
    requiredTotal: requiredItems.length,
    folderAssetCount: folderAssets.length
  }
}
