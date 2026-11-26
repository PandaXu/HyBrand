import { useMemo, useState } from 'react'
import {
  ArrowLeft,
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
  folderPath,
  formatDate,
  formatDateTime
} from '../utils.js'
import { COLOR_CATEGORY_LABELS, colorValues } from '../brand.js'
import {
  productCompletion,
  productFolderAssets,
  productLogo,
  productStatusLabel,
  productTypefaces
} from '../product.js'

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

export default function ProductSpace({ productId }) {
  const library = useApp((state) => state.library)
  const product = (library.products || []).find((item) => item.id === productId)
  const openDialog = useApp((state) => state.openDialog)
  const [showAllChecks, setShowAllChecks] = useState(false)
  const [copyMenu, setCopyMenu] = useState(null)
  const [exporting, setExporting] = useState(false)

  const completion = useMemo(
    () =>
      product
        ? productCompletion(product, library.brand, library.assets, library.folders)
        : null,
    [product, library.brand, library.assets, library.folders]
  )
  const logo = useMemo(
    () => (product ? productLogo(product, library.assets) : null),
    [product, library.assets]
  )
  const folderAssets = useMemo(
    () =>
      product
        ? productFolderAssets(product, library.assets, library.folders)
        : [],
    [product, library.assets, library.folders]
  )
  const typefaces = useMemo(
    () => productTypefaces(product, library.brand, library.assets),
    [product, library.brand, library.assets]
  )
  const byId = useMemo(
    () => new Map(library.assets.map((asset) => [asset.id, asset])),
    [library.assets]
  )
  const folderTrail = product?.folderId
    ? folderPath(library.folders, product.folderId)
    : []
  const fontFaces = useMemo(() => {
    const seen = new Set()
    const rules = []
    for (const typeface of library.brand?.typography || []) {
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
  }, [library.brand, byId])

  const heroImage = logo?.src || (folderAssets[0] ? cardImage(folderAssets[0]) : null)
  const initial = (product?.name || '产').trim().slice(0, 1).toUpperCase()

  if (!product) {
    return (
      <div className="brand-page product-page">
        <div className="brand-topstrip">
          <button
            className="topstrip-back"
            onClick={() => useApp.getState().setNav({ type: 'products' })}
          >
            <ArrowLeft size={15} /> 产品手册
          </button>
        </div>
        <div className="brand-scroll">
          <div className="brand-content">
            <div className="product-empty">
              <Package size={30} />
              <h2>产品不存在</h2>
              <button
                className="secondary-btn"
                onClick={() => useApp.getState().setNav({ type: 'products' })}
              >
                返回产品手册
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function editProduct() {
    openDialog({ type: 'product-profile', productId: product.id })
  }

  async function exportManual() {
    if (exporting) return
    setExporting(true)
    const result = await callApi(
      api.exportProductManual(product.id),
      '导出产品手册失败'
    )
    setExporting(false)
    if (!result) return
    toast(`产品手册已导出：${result.path}`, 'success')
    if (result.warnings?.length) toast(result.warnings[0], 'info')
  }

  function editLogo() {
    openDialog({ type: 'product-logo', productId: product.id })
  }

  function removeLogo() {
    openDialog({
      type: 'confirm',
      title: '移除产品 Logo',
      message: '确定从产品手册中移除 Logo 吗？素材文件不会被删除。',
      confirmLabel: '移除',
      danger: true,
      onConfirm: async () => {
        const result = await callApi(api.removeProductLogo(product.id), '移除失败')
        if (result) toast('产品 Logo 已移除', 'success')
      }
    })
  }

  function addColor() {
    openDialog({ type: 'product-color', productId: product.id })
  }

  function editColor(color) {
    openDialog({ type: 'product-color', productId: product.id, color })
  }

  function removeColor(color) {
    openDialog({
      type: 'confirm',
      title: '移除产品色',
      message: `确定移除「${color.name}」吗？`,
      confirmLabel: '移除',
      danger: true,
      onConfirm: async () => {
        const result = await callApi(
          api.removeProductColor(product.id, color.id),
          '移除失败'
        )
        if (result) toast('产品色已移除', 'success')
      }
    })
  }

  function editTypefaces() {
    openDialog({ type: 'product-typefaces', productId: product.id })
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

  function openFolder() {
    if (product.folderId) {
      useApp.getState().setNav({ type: 'folder', id: product.folderId })
    } else {
      editProduct()
    }
  }

  function deleteProduct() {
    openDialog({
      type: 'confirm',
      title: '删除产品',
      message: `确定删除「${product.name}」的产品手册吗？产品素材不会被删除。`,
      confirmLabel: '删除产品',
      danger: true,
      onConfirm: async () => {
        const result = await callApi(api.deleteProduct(product.id), '删除产品失败')
        if (!result) return
        useApp.getState().setNav({ type: 'products' })
        useApp.getState().toast('产品已删除', 'success')
      }
    })
  }

  function handleChecklist(item) {
    if (item.done) return
    const type = item.action?.type
    if (type === 'logo') editLogo()
    else if (type === 'color') addColor()
    else if (type === 'typefaces') editTypefaces()
    else editProduct()
  }

  return (
    <div className="brand-page product-page">
      <div className="brand-topstrip">
        <div className="brand-topstrip-title product-breadcrumb">
          <button
            className="topstrip-back"
            onClick={() => useApp.getState().setNav({ type: 'products' })}
            title="返回产品手册"
          >
            <ArrowLeft size={15} />
          </button>
          <span className="brand-topstrip-icon">
            <Package size={15} />
          </span>
          <span className="product-breadcrumb-label">产品手册</span>
          <span className="crumb-separator">/</span>
          <strong>{product.name}</strong>
        </div>
        <div className="brand-top-actions">
          <span className="last-export">更新于 {formatDateTime(product.updatedAt)}</span>
          <button className="secondary-btn small" onClick={editProduct}>
            <Pencil size={14} /> 编辑产品
          </button>
          <button className="primary-btn" onClick={exportManual} disabled={exporting}>
            {exporting ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            导出产品手册
          </button>
        </div>
      </div>

      <div className="brand-scroll">
        <div className="brand-content">
          <style>{fontFaces}</style>

          <section className="brand-hero product-hero">
            <div
              className="brand-hero-logo product-hero-media"
              style={{
                background: product.colors[0]?.hex
                  ? `${product.colors[0].hex}1F`
                  : '#F5F6FB'
              }}
            >
              {heroImage ? (
                <img src={heroImage} alt={product.name} />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="brand-hero-copy">
              <span className="eyebrow">PRODUCT MANUAL</span>
              <div className="product-hero-chips">
                <span className={`product-status-chip status-${product.status}`}>
                  {productStatusLabel(product.status)}
                </span>
                {product.category ? <span className="product-category-chip">{product.category}</span> : null}
                {product.sku ? <span className="product-sku">{product.sku}</span> : null}
              </div>
              <h1>{product.name}</h1>
              <p className="brand-tagline">
                {product.tagline || '用一句话说明这个产品，让团队一眼记住。'}
              </p>
              <p className="brand-description">
                {product.description ||
                  '补充产品简介，说明它为谁设计、解决什么问题，以及和同品牌其他产品的区别。'}
              </p>
              {!logo?.available ? (
                <button className="text-link" onClick={editLogo}>
                  先添加一个产品 Logo
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
              <span>产品完整度</span>
              <small>
                必填 {completion.requiredDone}/{completion.requiredTotal}
              </small>
            </div>
          </section>

          <div className="bento-layout">
            <div className="bento-col bento-col-main">
              <section className="bento-card product-logo-card">
                <CardHead
                  title="产品 Logo"
                  meta={logo?.available ? '已设置' : '未设置'}
                  action={
                    <button className="icon-btn" onClick={editLogo} title="编辑产品 Logo">
                      <Pencil size={14} />
                    </button>
                  }
                />
                {logo?.available ? (
                  <div className="product-logo-display">
                    <div className="product-logo-preview">
                      <img src={logo.src} alt={product.name} />
                    </div>
                    <div className="product-logo-copy">
                      <strong>{product.logoLabel || logo.asset.name}</strong>
                      <span>{logo.asset.name}</span>
                      <p>
                        {[
                          product.logoMinWidth ? `最小宽度 ${product.logoMinWidth}` : '',
                          product.logoClearSpace ? `安全边距 ${product.logoClearSpace}` : ''
                        ]
                          .filter(Boolean)
                          .join(' · ') || '还没有设置 Logo 使用规则'}
                      </p>
                      {product.logoNote ? <small>{product.logoNote}</small> : null}
                    </div>
                    <div className="product-logo-actions">
                      <button className="icon-btn tiny" onClick={editLogo} title="编辑">
                        <Pencil size={12} />
                      </button>
                      <button
                        className="icon-btn tiny"
                        onClick={removeLogo}
                        title="移除"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bento-empty">
                    <ImageIcon size={26} />
                    <p>还没有产品 Logo。选择产品标识，并补充最小尺寸与安全边距。</p>
                    <button className="secondary-btn small" onClick={editLogo}>
                      <Plus size={13} /> 添加产品 Logo
                    </button>
                  </div>
                )}
              </section>

              <section className="bento-card colors-card">
                <CardHead
                  title="产品色"
                  meta={`${product.colors.length} 个颜色`}
                  action={
                    <button className="icon-btn" onClick={addColor} title="添加产品色">
                      <Plus size={16} />
                    </button>
                  }
                />
                {product.colors.length ? (
                  <div className="brand-color-list">
                    {product.colors.map((color) => {
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
                            {color.usage ? (
                              <span className="color-usage">{color.usage}</span>
                            ) : null}
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
                    <p>还没有产品色。建立这个产品自己的色彩组合。</p>
                    <button className="secondary-btn small" onClick={addColor}>
                      <Plus size={13} /> 添加产品色
                    </button>
                  </div>
                )}
              </section>

              <section className="bento-card product-type-card">
                <CardHead
                  title="产品字体"
                  meta="默认继承品牌字体，可单独覆盖"
                  action={
                    <button className="icon-btn" onClick={editTypefaces} title="设置产品字体">
                      <Pencil size={14} />
                    </button>
                  }
                />
                {typefaces.heading || typefaces.body ? (
                  <div className="product-type-pair">
                    <div className="product-type-sample">
                      <span>标题</span>
                      <strong
                        style={{
                          fontFamily: typefaces.heading
                            ? `'${typefaces.heading.family}', -apple-system, sans-serif`
                            : undefined,
                          fontWeight: typefaces.heading?.weight || 600
                        }}
                      >
                        {product.name}
                      </strong>
                      <small>
                        {typefaces.heading
                          ? `${typefaces.heading.name} · ${
                              typefaces.headingInherited ? '继承品牌' : '产品指定'
                            }`
                          : '品牌字体不可用'}
                      </small>
                    </div>
                    <div className="product-type-sample">
                      <span>正文</span>
                      <p
                        style={{
                          fontFamily: typefaces.body
                            ? `'${typefaces.body.family}', -apple-system, sans-serif`
                            : undefined,
                          fontWeight: typefaces.body?.weight || 400
                        }}
                      >
                        产品手册用于统一这个产品的视觉与表达。标题、正文和包装文案都从这里开始。
                      </p>
                      <small>
                        {typefaces.body
                          ? `${typefaces.body.name} · ${
                              typefaces.bodyInherited ? '继承品牌' : '产品指定'
                            }`
                          : '品牌字体不可用'}
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="bento-empty">
                    <Type size={26} />
                    <p>品牌手册里还没有可用字体，先去补充品牌字体。</p>
                    <button
                      className="secondary-btn small"
                      onClick={() => useApp.getState().setNav({ type: 'brand' })}
                    >
                      前往品牌手册
                    </button>
                  </div>
                )}
              </section>

              <section className="bento-card product-assets-card">
                <CardHead
                  title="产品素材"
                  meta={
                    product.folderId
                      ? `${folderAssets.length} 个素材 · ${
                          folderTrail.map((item) => item.name).join(' / ') || '文件夹不可用'
                        }`
                      : '未关联素材文件夹'
                  }
                  action={
                    <button className="icon-btn" onClick={openFolder} title="打开素材文件夹">
                      <FolderOpen size={15} />
                    </button>
                  }
                />
                {folderAssets.length ? (
                  <>
                    <div className="product-asset-grid">
                      {folderAssets.slice(0, 8).map((asset) => {
                        const src = cardImage(asset)
                        return (
                          <button
                            key={asset.id}
                            className="product-asset-thumb"
                            onClick={openFolder}
                            title={asset.name}
                          >
                            {src ? (
                              <img src={src} alt={asset.name} loading="lazy" />
                            ) : (
                              <ImageIcon size={16} />
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <button className="secondary-btn small full" onClick={openFolder}>
                      <FolderOpen size={13} /> 打开产品素材文件夹
                    </button>
                  </>
                ) : (
                  <div className="bento-empty">
                    <FolderOpen size={26} />
                    <p>
                      还没有关联产品素材文件夹。把包装、产品图和详情页素材放进同一个文件夹。
                    </p>
                    <button className="secondary-btn small" onClick={editProduct}>
                      <Pencil size={13} /> 关联素材文件夹
                    </button>
                  </div>
                )}
              </section>
            </div>

            <div className="bento-col bento-col-side">
              <section className="bento-card checklist-card">
                <CardHead
                  title="产品完整度"
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
                <button
                  className="check-toggle"
                  onClick={() => setShowAllChecks((value) => !value)}
                >
                  {showAllChecks
                    ? '收起建议项'
                    : `显示 ${completion.items.filter((item) => !item.required).length} 条建议项`}
                </button>
                {completion.insights.length ? (
                  <div className="coach-box">
                    <div className="coach-title">
                      <Sparkles size={13} /> Product Coach
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
                      <Check size={13} /> Product Coach
                    </div>
                    <p>产品手册的核心信息已经齐备，可以交付给团队使用了。</p>
                  </div>
                )}
              </section>

              <section className="bento-card product-info-card">
                <CardHead
                  title="产品信息"
                  action={
                    <button className="icon-btn" onClick={editProduct} title="编辑产品信息">
                      <Pencil size={14} />
                    </button>
                  }
                />
                <div className="product-info-list">
                  <div>
                    <span>状态</span>
                    <strong>{productStatusLabel(product.status)}</strong>
                  </div>
                  <div>
                    <span>分类</span>
                    <strong>{product.category || '—'}</strong>
                  </div>
                  <div>
                    <span>产品编号</span>
                    <strong>{product.sku || '—'}</strong>
                  </div>
                  <div>
                    <span>上市日期</span>
                    <strong>{product.launchDate ? formatDate(product.launchDate) : '—'}</strong>
                  </div>
                  <div>
                    <span>创建时间</span>
                    <strong>{formatDate(product.createdAt)}</strong>
                  </div>
                  <div>
                    <span>更新时间</span>
                    <strong>{formatDate(product.updatedAt)}</strong>
                  </div>
                </div>
                <button className="danger-text-btn" onClick={deleteProduct}>
                  <Trash2 size={13} /> 删除产品
                </button>
              </section>

              <section className="bento-card product-usage-card">
                <CardHead
                  title="产品使用规范"
                  action={
                    <button className="icon-btn" onClick={editProduct} title="编辑使用规范">
                      <Pencil size={14} />
                    </button>
                  }
                />
                <p className={`voice-text ${product.usage ? '' : 'muted'}`}>
                  {product.usage ||
                    '还没有产品使用规范。写清楚包装、图片、文案和渠道的禁区，团队才能用对。'}
                </p>
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
