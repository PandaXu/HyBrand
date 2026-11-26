import { useMemo, useState } from 'react'
import {
  Check,
  Circle,
  Copy,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Package,
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
  COLOR_CATEGORY_LABELS,
  colorValues,
  fontFamilies,
  LOGO_ROLE_LABELS,
  pairingsResolved,
  primaryLogoVariant,
  TYPE_ROLE_LABELS,
  typeScaleSteps
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
  } else if (action.type === 'typescale') {
    openDialog({ type: 'brand-typescale' })
  } else if (action.type === 'pairing') {
    openDialog({ type: 'brand-pairing' })
  }
}

export default function BrandSpace() {
  const brand = useApp((state) => state.library.brand)
  const assets = useApp((state) => state.library.assets)
  const openDialog = useApp((state) => state.openDialog)
  const toast = useApp((state) => state.toast)
  const [exporting, setExporting] = useState(false)
  const [showAllChecks, setShowAllChecks] = useState(false)
  const [copyMenu, setCopyMenu] = useState(null)

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
  const scaleSteps = useMemo(() => typeScaleSteps(brand, assets), [brand, assets])
  const typeGroups = useMemo(() => fontFamilies(brand, assets), [brand, assets])
  const pairings = useMemo(() => pairingsResolved(brand, assets), [brand, assets])
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

  async function copyValue(value, label) {
    const result = await callApi(api.copyText(value), '复制失败')
    if (result) toast(`已复制 ${label}`, 'success')
  }

  function openCopyMenu(event, color) {
    const rect = event.currentTarget.getBoundingClientRect()
    setCopyMenu({
      color,
      x: Math.min(window.innerWidth - 250, Math.max(8, rect.right - 220)),
      y: Math.min(window.innerHeight - 260, rect.bottom + 4)
    })
  }

  function addPairing() {
    openDialog({ type: 'brand-pairing' })
  }

  function editPairing(pairing) {
    openDialog({ type: 'brand-pairing', pairing })
  }

  function removePairing(pairing) {
    confirmRemove(
      '移除字体搭配',
      `确定移除「${pairing.name}」吗？字体文件不会被删除。`,
      () => api.removeBrandPairing(pairing.id)
    )
  }

  async function downloadTypeface(typeface) {
    const asset = byId.get(typeface.assetId)
    if (!asset || asset.trashed) {
      toast('字体素材不可用', 'error')
      return
    }
    const saved = await callApi(api.download(asset.id), '下载字体失败')
    if (saved) toast('字体文件已保存', 'success')
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
          <button
            className="secondary-btn small"
            onClick={() => useApp.getState().setNav({ type: 'products' })}
          >
            <Package size={14} /> 产品手册
          </button>
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
                meta={`${brand.typography.length} 个样式 · ${typeGroups.length} 个家族`}
                action={
                  <button className="icon-btn" onClick={addTypeface} title="添加字体">
                    <Plus size={16} />
                  </button>
                }
              />
              {typeGroups.length ? (
                <div className="font-family-list">
                  {typeGroups.map((family) => (
                    <div className="font-family-card" key={family.name}>
                      <div className="font-family-head">
                        <strong>{family.name}</strong>
                        <span>{family.variants.length} 个样式</span>
                      </div>
                      {family.variants.map(({ entry, asset, available }) => {
                        const familyCss = available ? `BrandFont-${asset.id}` : 'inherit'
                        return (
                          <div className="typeface-row" key={entry.id}>
                            <div
                              className="typeface-sample"
                              style={{
                                fontFamily: `'${familyCss}', -apple-system, sans-serif`,
                                fontWeight: entry.weight || 400
                              }}
                            >
                              {entry.sample || `${brand.name || '品牌'} Aa 0123`}
                            </div>
                            <div className="typeface-meta">
                              <div className="type-meta-row">
                                <span className="role-chip">{TYPE_ROLE_LABELS[entry.role]}</span>
                                <span className="weight-chip">{entry.weight || 400}</span>
                              </div>
                              <strong>{entry.name || asset?.name || '素材不可用'}</strong>
                              {entry.note ? <p>{entry.note}</p> : null}
                              <span className="typeface-file">{asset?.name || '素材不可用'}</span>
                            </div>
                            <div className="row-tools">
                              <button
                                className="icon-btn tiny"
                                onClick={() => downloadTypeface(entry)}
                                title="下载字体文件"
                              >
                                <Download size={12} />
                              </button>
                              <button
                                className="icon-btn tiny"
                                onClick={() => editTypeface(entry)}
                                title="编辑"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                className="icon-btn tiny"
                                onClick={() => removeTypeface(entry)}
                                title="移除"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bento-empty">
                  <Type size={26} />
                  <p>还没有字体。添加品牌字体后，可为每个字重建立样式。</p>
                  <button className="secondary-btn small" onClick={addTypeface}>
                    <Plus size={13} /> 添加字体
                  </button>
                </div>
              )}

              <div className="type-subhead">
                <span>字阶</span>
                <button className="text-link" onClick={() => openDialog({ type: 'brand-typescale' })}>
                  编辑字阶
                </button>
              </div>
              <div className="scale-list">
                {scaleSteps.map((step) => (
                  <div className="scale-row" key={step.key}>
                    <div className="scale-meta">
                      <span>{step.label}</span>
                      <small>
                        {step.size}px / {step.lineHeight}
                      </small>
                      <em>{step.fontName}</em>
                    </div>
                    <div
                      className="scale-sample"
                      style={{
                        fontFamily:
                          step.family === 'inherit'
                            ? undefined
                            : `'${step.family}', -apple-system, sans-serif`,
                        fontSize: `${Math.min(step.size, 40)}px`,
                        fontWeight: step.weight,
                        lineHeight: step.lineHeight
                      }}
                    >
                      {step.key === 'display' ? brand.name || step.sample : step.sample}
                    </div>
                  </div>
                ))}
              </div>

              <div className="type-subhead">
                <span>字体搭配</span>
                <button className="text-link" onClick={addPairing}>
                  添加搭配
                </button>
              </div>
              {pairings.length ? (
                <div className="pairing-list">
                  {pairings.map((pairing) => (
                    <div className="pairing-card" key={pairing.id}>
                      <div className="pairing-card-head">
                        <strong>{pairing.name}</strong>
                        <div className="pairing-tools">
                          <button
                            className="icon-btn tiny"
                            onClick={() => editPairing(pairing)}
                            title="编辑搭配"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className="icon-btn tiny"
                            onClick={() => removePairing(pairing)}
                            title="移除搭配"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <div
                        className="pairing-heading"
                        style={{
                          fontFamily: pairing.heading
                            ? `'${pairing.heading.family}', -apple-system, sans-serif`
                            : undefined,
                          fontWeight: pairing.heading?.weight || 600
                        }}
                      >
                        {brand.name || '品牌标题'}
                      </div>
                      <div
                        className="pairing-body"
                        style={{
                          fontFamily: pairing.body
                            ? `'${pairing.body.family}', -apple-system, sans-serif`
                            : undefined,
                          fontWeight: pairing.body?.weight || 400
                        }}
                      >
                        让品牌交付变得确定。标题、正文和注释各有清晰层级，团队可以直接照着使用。
                      </div>
                      {pairing.note ? <p className="pairing-note">{pairing.note}</p> : null}
                      <span className="pairing-meta">
                        标题：{pairing.heading?.name || '未指定'} · 正文：
                        {pairing.body?.name || '未指定'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bento-empty small">
                  <Type size={20} />
                  <p>还没有字体搭配。添加一组标题 / 正文字体组合。</p>
                  <button className="secondary-btn small" onClick={addPairing}>
                    <Plus size={13} /> 添加搭配
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
                          <div className="color-name-row">
                            <span className="role-chip">
                              {COLOR_CATEGORY_LABELS[color.category] || '主色'}
                            </span>
                            <strong>{color.name}</strong>
                          </div>
                          <span className="color-value-line">
                            {color.hex} · RGB {values.rgb}
                          </span>
                          {color.usage ? <span className="color-usage">{color.usage}</span> : null}
                        </div>
                        <div className="row-tools">
                          <button
                            className="icon-btn tiny"
                            onClick={(event) => openCopyMenu(event, color)}
                            title="复制其他格式"
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

      {copyMenu ? (
        <>
          <div className="menu-backdrop" onClick={() => setCopyMenu(null)} />
          <div
            className="floating-menu color-copy-menu"
            style={{ left: copyMenu.x, top: copyMenu.y }}
          >
            {[
              ['HEX', colorValues(copyMenu.color.hex).hex],
              ['RGB', colorValues(copyMenu.color.hex).rgb],
              ['HSL', colorValues(copyMenu.color.hex).hsl],
              ['CMYK', colorValues(copyMenu.color.hex).cmyk],
              ...(copyMenu.color.pantone
                ? [['Pantone', copyMenu.color.pantone]]
                : [])
            ].map(([label, value]) => (
              <button
                key={label}
                onClick={() => {
                  copyValue(value, label)
                  setCopyMenu(null)
                }}
              >
                <span>{label}</span>
                <code>{value}</code>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function roleLabel(role) {
  return LOGO_ROLE_LABELS[role] || role
}
