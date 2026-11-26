import { useMemo, useState } from 'react'
import {
  Check,
  Circle,
  Copy,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Type
} from 'lucide-react'
import { useApp } from '../store.js'
import api from '../api.js'
import { callApi, toast } from '../actions.js'
import {
  assetUrl,
  cardImage,
  formatDateTime
} from '../utils.js'
import {
  brandCompletion,
  colorValues,
  LOGO_ROLE_LABELS,
  primaryLogoVariant,
  TYPE_ROLE_LABELS
} from '../brand.js'

function CardHead({ title, meta, action }) {
  return (
    <div className="card-head">
      <div>
        <h2>{title}</h2>
        {meta ? <span className="card-sub">{meta}</span> : null}
      </div>
      {action}
    </div>
  )
}

function ChecklistAction({ item, brand, openDialog }) {
  if (item.done) return null
  const action = item.action || {}
  if (action.type === 'profile') {
    openDialog({ type: 'brand-profile' })
  } else if (action.type === 'logo') {
    openDialog({ type: 'brand-logo', role: action.role || 'primary' })
  } else if (action.type === 'logo-edit') {
    const variant = brand.logoVariants.find((entry) => entry.id === action.variantId)
    if (variant) openDialog({ type: 'brand-logo', variant })
    else openDialog({ type: 'brand-logo', role: 'primary' })
  } else if (action.type === 'color') {
    openDialog({ type: 'brand-color' })
  } else if (action.type === 'typeface') {
    openDialog({ type: 'brand-typeface' })
  }
}

export default function BrandSpace() {
  const brand = useApp((state) => state.library.brand)
  const assets = useApp((state) => state.library.assets)
  const openDialog = useApp((state) => state.openDialog)
  const toast = useApp((state) => state.toast)
  const [exporting, setExporting] = useState(false)
  const [showAllChecks, setShowAllChecks] = useState(false)

  const completion = useMemo(() => brandCompletion(brand, assets), [brand, assets])
  const primary = useMemo(() => primaryLogoVariant(brand, assets), [brand, assets])
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])
  const activeAssets = useMemo(() => assets.filter((asset) => !asset.trashed), [assets])
  const recentAssets = useMemo(
    () =>
      [...activeAssets]
        .sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt)))
        .slice(0, 4),
    [activeAssets]
  )
  const assetCounts = useMemo(() => {
    const counts = { image: 0, video: 0, font: 0, doc: 0 }
    for (const asset of activeAssets) {
      if (asset.kind === 'image') counts.image += 1
      else if (asset.kind === 'video') counts.video += 1
      else if (asset.kind === 'font') counts.font += 1
      else if (asset.kind === 'doc' || asset.kind === 'design') counts.doc += 1
    }
    return counts
  }, [activeAssets])

  const fontFaces = useMemo(() => {
    const seen = new Set()
    const rules = []
    for (const typeface of brand?.typography || []) {
      const asset = byId.get(typeface.assetId)
      if (!asset || asset.trashed || seen.has(asset.id)) continue
      seen.add(asset.id)
      rules.push(
        `@font-face{font-family:'BrandFont-${asset.id}';src:url('${assetUrl(
          asset
        )}');font-display:swap;}`
      )
    }
    return rules.join('\n')
  }, [brand, byId])

  if (!brand) return <div className="brand-page" />

  const initial = (brand.name || 'H').trim().slice(0, 1).toUpperCase() || 'H'
  const primaryImage = primary ? cardImage(primary.asset) : null

  function openProfile() {
    openDialog({ type: 'brand-profile' })
  }

  function addLogo(role = 'primary') {
    openDialog({ type: 'brand-logo', role })
  }

  function addColor() {
    openDialog({ type: 'brand-color' })
  }

  function addTypeface() {
    openDialog({ type: 'brand-typeface' })
  }

  function editLogo(variant) {
    openDialog({ type: 'brand-logo', variant })
  }

  function editColor(color) {
    openDialog({ type: 'brand-color', color })
  }

  function editTypeface(typeface) {
    openDialog({ type: 'brand-typeface', typeface })
  }

  function confirmRemove(title, message, action) {
    openDialog({
      type: 'confirm',
      title,
      message,
      confirmLabel: '移除',
      danger: true,
      onConfirm: async () => {
        const result = await callApi(action(), '移除失败')
        if (result) toast('已移除', 'success')
      }
    })
  }

  function removeLogo(variant) {
    const asset = byId.get(variant.assetId)
    const label = variant.label || asset?.name || LOGO_ROLE_LABELS[variant.role] || 'Logo'
    confirmRemove(
      '移除 Logo 变体',
      `确定从品牌手册中移除「${label}」吗？素材文件不会被删除。`,
      () => api.removeBrandLogo(variant.id)
    )
  }

  function removeColor(color) {
    confirmRemove(
      '移除品牌色',
      `确定移除「${color.name}」吗？`,
      () => api.removeBrandColor(color.id)
    )
  }

  function removeTypeface(typeface) {
    const asset = byId.get(typeface.assetId)
    confirmRemove(
      '移除字体',
      `确定从品牌手册中移除「${typeface.name || asset?.name || '字体'}」吗？素材文件不会被删除。`,
      () => api.removeBrandTypeface(typeface.id)
    )
  }

  async function copyColor(hex) {
    const result = await callApi(api.copyText(hex), '复制失败')
    if (result) toast(`已复制 ${hex}`, 'success')
  }

  async function exportKit() {
    if (exporting) return
    setExporting(true)
    const result = await callApi(api.exportBrandKit(), '导出品牌包失败')
    setExporting(false)
    if (!result) return
    toast(`品牌包已导出：${result.path}`, 'success')
    if (result.warnings?.length) toast(result.warnings[0], 'info')
  }

  function handleChecklist(item) {
    ChecklistAction({ item, brand, openDialog })
  }

  return (
    <div className="brand-page">
      <div className="brand-topstrip">
        <div className="brand-topstrip-title">
          <span className="brand-topstrip-icon">
            <Sparkles size={15} />
          </span>
          品牌手册
        </div>
        <div className="brand-top-actions">
          {brand.lastExportedAt ? (
            <span className="last-export">上次导出 {formatDateTime(brand.lastExportedAt)}</span>
          ) : null}
          <button className="secondary-btn small" onClick={openProfile}>
            <Pencil size={14} /> 编辑品牌
          </button>
          <button className="primary-btn" onClick={exportKit} disabled={exporting}>
            {exporting ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            导出品牌包
          </button>
        </div>
      </div>

      <div className="brand-scroll">
        <div className="brand-content">
          <style>{fontFaces}</style>

          <section className="brand-hero">
            <div className="brand-hero-logo" style={{ background: brand.colors[0]?.hex ? `${brand.colors[0].hex}1F` : '#F5F6FB' }}>
              {primaryImage ? (
                <img src={primaryImage} alt={primary.asset.name} />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="brand-hero-copy">
              <span className="eyebrow">BRAND SPACE</span>
              <h1>{brand.name || '未命名品牌'}</h1>
              <p className="brand-tagline">
                {brand.tagline || '用一句话定义品牌定位，让团队一眼记住。'}
              </p>
              <p className="brand-description">
                {brand.description ||
                  '补充品牌简介，说明品牌为谁服务、解决什么问题，以及它和竞品的区别。'}
              </p>
              {!primary ? (
                <button className="text-link" onClick={() => addLogo('primary')}>
                  先添加一个主 Logo
                </button>
              ) : null}
            </div>
            <div className="brand-completion">
              <div
                className="score-ring"
                style={{
                  background: `conic-gradient(var(--accent) ${completion.score}%, #EEF0F6 0)`
                }}
              >
                <span>{completion.score}%</span>
              </div>
              <span>品牌完整度</span>
              <small>
                必填 {completion.requiredDone}/{completion.requiredTotal}
              </small>
            </div>
          </section>

          <div className="bento-layout">
            <div className="bento-col bento-col-main">
<section className="bento-card logo-card">
              <CardHead
                title="Logo"
                meta={`${brand.logoVariants.length} 个变体`}
                action={
                  <button className="icon-btn" onClick={() => addLogo('primary')} title="添加 Logo">
                    <Plus size={16} />
                  </button>
                }
              />
              {brand.logoVariants.length ? (
                <div className="logo-variant-grid">
                  {brand.logoVariants.map((variant) => {
                    const asset = byId.get(variant.assetId)
                    const available = asset && !asset.trashed
                    const src = available ? cardImage(asset) : null
                    return (
                      <div
                        className="logo-variant"
                        key={variant.id}
                        onClick={() => editLogo(variant)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') editLogo(variant)
                        }}
                      >
                        <div className="logo-variant-preview">
                          {src ? (
                            <img src={src} alt={variant.label || roleLabel(variant.role)} />
                          ) : (
                            <ImageIcon size={22} />
                          )}
                        </div>
                        <div className="logo-variant-meta">
                          <span className="role-chip">{LOGO_ROLE_LABELS[variant.role]}</span>
                          <strong>{variant.label || asset?.name || '素材不可用'}</strong>
                          <span className="variant-rules">
                            {variant.minWidth || variant.clearSpace
                              ? [
                                  variant.minWidth ? `最小 ${variant.minWidth}` : '',
                                  variant.clearSpace ? `边距 ${variant.clearSpace}` : ''
                                ]
                                  .filter(Boolean)
                                  .join(' · ')
                              : '未设置使用规则'}
                          </span>
                        </div>
                        <div className="variant-tools">
                          <button
                            className="icon-btn tiny"
                            onClick={(event) => {
                              event.stopPropagation()
                              editLogo(variant)
                            }}
                            title="编辑"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className="icon-btn tiny"
                            onClick={(event) => {
                              event.stopPropagation()
                              removeLogo(variant)
                            }}
                            title="移除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bento-empty">
                  <ImageIcon size={26} />
                  <p>还没有 Logo 变体。先指定一个官方主 Logo。</p>
                  <button className="secondary-btn small" onClick={() => addLogo('primary')}>
                    <Plus size={13} /> 添加 Logo
                  </button>
                </div>
              )}
            </section>
<section className="bento-card type-card">
              <CardHead
                title="字体"
                meta={`${brand.typography.length} 个字体角色`}
                action={
                  <button className="icon-btn" onClick={addTypeface} title="添加字体">
                    <Plus size={16} />
                  </button>
                }
              />
              {brand.typography.length ? (
                <div className="typeface-list">
                  {brand.typography.map((typeface) => {
                    const asset = byId.get(typeface.assetId)
                    const available = asset && !asset.trashed
                    const family = available ? `BrandFont-${asset.id}` : 'inherit'
                    return (
                      <div className="typeface-row" key={typeface.id}>
                        <div
                          className="typeface-sample"
                          style={{ fontFamily: `'${family}', -apple-system, sans-serif` }}
                        >
                          {typeface.sample || `${brand.name || '品牌'} Aa 0123`}
                        </div>
                        <div className="typeface-meta">
                          <span className="role-chip">{TYPE_ROLE_LABELS[typeface.role]}</span>
                          <strong>{typeface.name || asset?.name || '素材不可用'}</strong>
                          {typeface.note ? <p>{typeface.note}</p> : null}
                          <span className="typeface-file">{asset?.name || '素材不可用'}</span>
                        </div>
                        <div className="row-tools">
                          <button
                            className="icon-btn tiny"
                            onClick={() => editTypeface(typeface)}
                            title="编辑"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className="icon-btn tiny"
                            onClick={() => removeTypeface(typeface)}
                            title="移除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bento-empty">
                  <Type size={26} />
                  <p>还没有字体角色。添加品牌字体、标题字体或正文字体。</p>
                  <button className="secondary-btn small" onClick={addTypeface}>
                    <Plus size={13} /> 添加字体
                  </button>
                </div>
              )}
            </section>
<section className="bento-card voice-card">
              <CardHead
                title="品牌语气"
                action={
                  <button className="icon-btn" onClick={openProfile} title="编辑品牌语气">
                    <Pencil size={14} />
                  </button>
                }
              />
              <p className={`voice-text ${brand.voice ? '' : 'muted'}`}>
                {brand.voice ||
                  '还没有品牌语气说明。写清楚品牌怎么说话、避免什么表达，团队才能保持一致。'}
              </p>
            </section>
            </div>
            <div className="bento-col bento-col-side">
<section className="bento-card checklist-card">
              <CardHead
                title="品牌完整度"
                meta={`必填 ${completion.requiredDone}/${completion.requiredTotal} · 建议 ${
                  completion.items.filter((item) => !item.required && item.done).length
                }/${completion.items.filter((item) => !item.required).length}`}
              />
              <div className="completion-bar">
                <span style={{ width: `${completion.score}%` }} />
              </div>
              <div className="checklist">
                {completion.items
                  .filter((item) => item.required || showAllChecks)
                  .map((item) => (
                    <button
                      key={item.key}
                      className={`check-row ${item.done ? 'done' : ''}`}
                      disabled={item.done}
                      onClick={() => handleChecklist(item)}
                    >
                      <span className={`check-mark ${item.done ? 'done' : ''}`}>
                        {item.done ? <Check size={11} /> : <Circle size={8} />}
                      </span>
                      <span className="check-label">{item.label}</span>
                      {!item.required ? <span className="check-badge">建议</span> : null}
                      {!item.done ? <span className="check-go">去补全</span> : null}
                    </button>
                  ))}
              </div>
              <button className="check-toggle" onClick={() => setShowAllChecks((value) => !value)}>
                {showAllChecks
                  ? '收起建议项'
                  : `显示 ${completion.items.filter((item) => !item.required).length} 条建议项`}
              </button>
              {completion.insights.length ? (
                <div className="coach-box">
                  <div className="coach-title">
                    <Sparkles size={13} /> Brand Coach
                  </div>
                  <ul>
                    {completion.insights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="coach-box complete">
                  <div className="coach-title">
                    <Check size={13} /> Brand Coach
                  </div>
                  <p>核心品牌资产已经齐备，可以导出一份品牌包了。</p>
                </div>
              )}
            </section>
<section className="bento-card colors-card">
              <CardHead
                title="品牌色"
                meta={`${brand.colors.length} 个颜色`}
                action={
                  <button className="icon-btn" onClick={addColor} title="添加品牌色">
                    <Plus size={16} />
                  </button>
                }
              />
              {brand.colors.length ? (
                <div className="brand-color-list">
                  {brand.colors.map((color) => {
                    const values = colorValues(color.hex)
                    return (
                      <div className="brand-color-row" key={color.id}>
                        <button
                          className="brand-color-swatch"
                          style={{ background: color.hex }}
                          onClick={() => copyColor(color.hex)}
                          title={`复制 ${color.hex}`}
                        />
                        <div className="brand-color-copy">
                          <strong>{color.name}</strong>
                          <span>
                            {color.hex} · RGB {values.rgb}
                          </span>
                          {color.pantone ? <span>{color.pantone}</span> : null}
                        </div>
                        <div className="row-tools">
                          <button
                            className="icon-btn tiny"
                            onClick={() => copyColor(color.hex)}
                            title="复制 HEX"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            className="icon-btn tiny"
                            onClick={() => editColor(color)}
                            title="编辑"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className="icon-btn tiny"
                            onClick={() => removeColor(color)}
                            title="移除"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bento-empty">
                  <Palette size={26} />
                  <p>还没有品牌色。添加主色和辅助色，团队就不会用错。</p>
                  <button className="secondary-btn small" onClick={addColor}>
                    <Plus size={13} /> 添加品牌色
                  </button>
                </div>
              )}
            </section>
<section className="bento-card assets-card">
              <CardHead title="品牌素材" meta={`${activeAssets.length} 个可用素材`} />
              <div className="asset-stat-grid">
                <div>
                  <strong>{assetCounts.image}</strong>
                  <span>图片</span>
                </div>
                <div>
                  <strong>{assetCounts.video}</strong>
                  <span>视频</span>
                </div>
                <div>
                  <strong>{assetCounts.font}</strong>
                  <span>字体</span>
                </div>
                <div>
                  <strong>{assetCounts.doc}</strong>
                  <span>设计 / 文档</span>
                </div>
              </div>
              {recentAssets.length ? (
                <div className="recent-assets">
                  {recentAssets.map((asset) => {
                    const src = cardImage(asset)
                    return (
                      <button
                        key={asset.id}
                        className="recent-asset"
                        onClick={() => useApp.getState().setNav({ type: 'all' })}
                        title={asset.name}
                      >
                        {src ? <img src={src} alt={asset.name} /> : <ImageIcon size={14} />}
                      </button>
                    )
                  })}
                </div>
              ) : null}
              <button
                className="secondary-btn small full"
                onClick={() => useApp.getState().setNav({ type: 'all' })}
              >
                <FolderOpen size={13} /> 打开素材库
              </button>
            </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function roleLabel(role) {
  return LOGO_ROLE_LABELS[role] || role
}
