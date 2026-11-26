import { useMemo, useState } from 'react'
import { Loader2, Type, X } from 'lucide-react'
import { Modal } from './Dialogs.jsx'
import { useApp } from '../store.js'
import api from '../api.js'
import { callApi, toast } from '../actions.js'
import { flatFolders } from '../utils.js'
import { fontFamilies } from '../brand.js'
import { PRODUCT_STATUSES, productTypefaces } from '../product.js'

function ProductProfileDialog({ dialog, onClose }) {
  const library = useApp((state) => state.library)
  const product = dialog.productId
    ? (library.products || []).find((item) => item.id === dialog.productId)
    : null
  const editing = Boolean(product)
  const [form, setForm] = useState({
    name: product?.name || '',
    tagline: product?.tagline || '',
    description: product?.description || '',
    category: product?.category || '',
    status: product?.status || 'concept',
    launchDate: product?.launchDate || '',
    sku: product?.sku || '',
    folderId: product?.folderId || '',
    usage: product?.usage || ''
  })
  const folders = useMemo(() => flatFolders(library.folders), [library.folders])
  const [busy, setBusy] = useState(false)

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim() || busy) return
    setBusy(true)
    const result = await callApi(
      editing
        ? api.updateProduct(product.id, form)
        : api.createProduct(form),
      editing ? '保存产品失败' : '创建产品失败'
    )
    setBusy(false)
    if (!result) return
    toast(editing ? '产品信息已保存' : '产品已创建', 'success')
    onClose()
    if (!editing) useApp.getState().setNav({ type: 'product', productId: result.id })
  }

  return (
    <Modal onClose={onClose} width={660}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>{editing ? '编辑产品' : '新建产品'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="modal-message">
          每个产品都有独立的产品手册：产品信息、产品色、字体、素材文件夹与使用规范。
        </p>
        <div className="brand-form-grid">
          <label className="brand-field full">
            <span>产品名称</span>
            <input
              autoFocus
              name="product-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="例如：春日限定乌龙"
              maxLength={80}
            />
          </label>
          <label className="brand-field">
            <span>产品分类</span>
            <input
              name="product-category"
              value={form.category}
              onChange={(event) => update('category', event.target.value)}
              placeholder="例如：茶饮 / 瓶装"
              maxLength={40}
            />
          </label>
          <label className="brand-field">
            <span>产品状态</span>
            <select
              name="product-status"
              value={form.status}
              onChange={(event) => update('status', event.target.value)}
            >
              {PRODUCT_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="brand-field">
            <span>上市日期</span>
            <input
              name="product-launch-date"
              type="date"
              value={form.launchDate}
              onChange={(event) => update('launchDate', event.target.value)}
            />
          </label>
          <label className="brand-field">
            <span>产品编号 / SKU</span>
            <input
              name="product-sku"
              value={form.sku}
              onChange={(event) => update('sku', event.target.value)}
              placeholder="例如：SPRING-01"
              maxLength={60}
            />
          </label>
          <label className="brand-field full">
            <span>产品素材文件夹</span>
            <select
              name="product-folder"
              value={form.folderId}
              onChange={(event) => update('folderId', event.target.value)}
            >
              <option value="">不关联素材文件夹</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {'　'.repeat(folder.depth)}
                  {folder.name}
                </option>
              ))}
            </select>
            {!folders.length ? (
              <small className="field-hint">
                还没有文件夹。可以先在素材库创建产品素材文件夹。
              </small>
            ) : null}
          </label>
          <label className="brand-field full">
            <span>一句话产品定位</span>
            <input
              name="product-tagline"
              value={form.tagline}
              onChange={(event) => update('tagline', event.target.value)}
              placeholder="例如：把春天装进一瓶茶里"
              maxLength={160}
            />
          </label>
          <label className="brand-field full">
            <span>产品简介</span>
            <textarea
              name="product-description"
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="产品是什么、为谁设计、和同系列产品的区别"
              rows={3}
              maxLength={2000}
            />
          </label>
          <label className="brand-field full">
            <span>产品使用规范</span>
            <textarea
              name="product-usage"
              value={form.usage}
              onChange={(event) => update('usage', event.target.value)}
              placeholder="例如：包装必须使用主 Logo；产品摄影保留留白；不改变产品色比例"
              rows={4}
              maxLength={5000}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-btn" disabled={!form.name.trim() || busy}>
            {busy ? <Loader2 size={15} className="spin" /> : null}
            {editing ? '保存产品' : '创建产品'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ProductTypefacesDialog({ dialog, onClose }) {
  const library = useApp((state) => state.library)
  const product = (library.products || []).find((item) => item.id === dialog.productId)
  const brand = library.brand
  const [headingId, setHeadingId] = useState(product?.headingTypefaceId || '')
  const [bodyId, setBodyId] = useState(product?.bodyTypefaceId || '')
  const [busy, setBusy] = useState(false)

  const variants = useMemo(
    () =>
      fontFamilies(brand, library.assets).flatMap((family) =>
        family.variants.map((variant) => ({
          ...variant,
          familyName: family.name
        }))
      ),
    [brand, library.assets]
  )
  const effective = useMemo(
    () =>
      productTypefaces(
        {
          ...product,
          headingTypefaceId: headingId || null,
          bodyTypefaceId: bodyId || null
        },
        brand,
        library.assets
      ),
    [product, headingId, bodyId, brand, library.assets]
  )

  async function submit(event) {
    event.preventDefault()
    if (!product || busy) return
    setBusy(true)
    const result = await callApi(
      api.updateProductTypefaces({
        productId: product.id,
        headingTypefaceId: headingId || null,
        bodyTypefaceId: bodyId || null
      }),
      '保存产品字体失败'
    )
    setBusy(false)
    if (result) {
      toast('产品字体已保存', 'success')
      onClose()
    }
  }

  return (
    <Modal onClose={onClose} width={620}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>产品字体</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="modal-message">
          产品默认继承品牌字体，也可以为这个产品单独指定标题和正文字体。
        </p>
        {!variants.length ? (
          <div className="picker-empty">
            <Type size={24} />
            <p>品牌手册里还没有可用字体。先到品牌手册添加字体。</p>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                onClose()
                useApp.getState().setNav({ type: 'brand' })
              }}
            >
              前往品牌手册
            </button>
          </div>
        ) : (
          <>
            <div className="brand-form-grid">
              <label className="brand-field">
                <span>标题字体</span>
                <select
                  name="product-heading-font"
                  value={headingId}
                  onChange={(event) => setHeadingId(event.target.value)}
                >
                  <option value="">继承品牌标题字体</option>
                  {variants.map((variant) => (
                    <option
                      key={variant.entry.id}
                      value={variant.entry.id}
                      disabled={!variant.available}
                    >
                      {variant.familyName} · {variant.entry.name || '字体'} ·{' '}
                      {variant.entry.weight}
                    </option>
                  ))}
                </select>
              </label>
              <label className="brand-field">
                <span>正文字体</span>
                <select
                  name="product-body-font"
                  value={bodyId}
                  onChange={(event) => setBodyId(event.target.value)}
                >
                  <option value="">继承品牌正文字体</option>
                  {variants.map((variant) => (
                    <option
                      key={variant.entry.id}
                      value={variant.entry.id}
                      disabled={!variant.available}
                    >
                      {variant.familyName} · {variant.entry.name || '字体'} ·{' '}
                      {variant.entry.weight}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="product-type-preview">
              <div className="product-type-preview-head">
                <span>标题预览</span>
                <small>{effective.heading?.name || '继承品牌字体'}</small>
              </div>
              <div
                className="product-type-preview-heading"
                style={{
                  fontFamily: effective.heading
                    ? `'${effective.heading.family}', -apple-system, sans-serif`
                    : undefined,
                  fontWeight: effective.heading?.weight || 600
                }}
              >
                {product?.name || '产品标题'}
              </div>
              <div className="product-type-preview-head">
                <span>正文预览</span>
                <small>{effective.body?.name || '继承品牌字体'}</small>
              </div>
              <div
                className="product-type-preview-body"
                style={{
                  fontFamily: effective.body
                    ? `'${effective.body.family}', -apple-system, sans-serif`
                    : undefined,
                  fontWeight: effective.body?.weight || 400
                }}
              >
                产品手册用于统一这个产品的视觉与表达。标题、正文和包装文案都从这里开始。
              </div>
            </div>
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-btn" disabled={busy || !variants.length}>
            {busy ? <Loader2 size={15} className="spin" /> : null}
            保存字体设置
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function ProductDialogs() {
  const dialog = useApp((state) => state.dialog)
  const closeDialog = useApp((state) => state.closeDialog)
  if (!dialog) return null
  if (dialog.type === 'product-profile') {
    return <ProductProfileDialog dialog={dialog} onClose={closeDialog} />
  }
  if (dialog.type === 'product-typefaces') {
    return <ProductTypefacesDialog dialog={dialog} onClose={closeDialog} />
  }
  return null
}
