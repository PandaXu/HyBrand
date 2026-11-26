import { useMemo, useState } from 'react'
import {
  FolderOpen,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload
} from 'lucide-react'
import { useApp } from '../store.js'
import api from '../api.js'
import { callApi, toast } from '../actions.js'
import { cardImage, formatDateTime } from '../utils.js'
import {
  PRODUCT_STATUSES,
  productCompletion,
  productFolderAssets,
  productLogo,
  productStatusLabel
} from '../product.js'

export default function ProductsPage() {
  const library = useApp((state) => state.library)
  const openDialog = useApp((state) => state.openDialog)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [importing, setImporting] = useState(false)
  const products = library.products || []

  const prepared = useMemo(
    () =>
      products
        .map((product) => {
          const logo = productLogo(product, library.assets)
          const folderAssets = productFolderAssets(
            product,
            library.assets,
            library.folders
          )
          const completion = productCompletion(
            product,
            library.brand,
            library.assets,
            library.folders
          )
          return {
            product,
            logo,
            folderAssets,
            completion,
            cover:
              logo.src ||
              (folderAssets[0] ? cardImage(folderAssets[0]) : null)
          }
        })
        .sort((a, b) =>
          String(b.product.updatedAt).localeCompare(String(a.product.updatedAt))
        ),
    [products, library.assets, library.folders, library.brand]
  )

  const visible = prepared.filter(({ product }) => {
    const text = `${product.name} ${product.category} ${product.tagline}`.toLowerCase()
    if (query.trim() && !text.includes(query.trim().toLowerCase())) return false
    if (status !== 'all' && product.status !== status) return false
    return true
  })

  const activeCount = products.filter((product) => product.status === 'active').length
  const needsWork = prepared.filter(({ completion }) => completion.score < 60).length

  function createProduct() {
    openDialog({ type: 'product-profile' })
  }

  async function importManual() {
    if (importing) return
    setImporting(true)
    const result = await callApi(api.importProductManual(), '导入产品手册失败')
    setImporting(false)
    if (!result) return
    useApp.getState().setNav({ type: 'product', productId: result.productId })
    toast(`已导入产品「${result.name}」`, 'success')
    if (result.warnings?.length) toast(result.warnings[0], 'info')
  }

  function editProduct(product) {
    openDialog({ type: 'product-profile', productId: product.id })
  }

  function deleteProduct(product) {
    openDialog({
      type: 'confirm',
      title: '删除产品',
      message: `确定删除「${product.name}」的产品手册吗？产品素材不会被删除。`,
      confirmLabel: '删除产品',
      danger: true,
      onConfirm: async () => {
        const result = await callApi(api.deleteProduct(product.id), '删除产品失败')
        if (!result) return
        const state = useApp.getState()
        if (state.nav.type === 'product' && state.nav.productId === product.id) {
          state.setNav({ type: 'products' })
        }
        state.toast('产品已删除', 'success')
      }
    })
  }

  return (
    <div className="brand-page product-page">
      <div className="brand-topstrip">
        <div className="brand-topstrip-title">
          <span className="brand-topstrip-icon">
            <Package size={15} />
          </span>
          产品手册
        </div>
        <div className="brand-top-actions">
          <span className="product-count-note">{products.length} 个产品</span>
          <button className="secondary-btn small" onClick={importManual} disabled={importing}>
            {importing ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
            导入产品手册
          </button>
          <button className="primary-btn" onClick={createProduct}>
            <Plus size={15} /> 新建产品
          </button>
        </div>
      </div>

      <div className="brand-scroll">
        <div className="brand-content">
          <section className="product-index-hero">
            <div>
              <span className="eyebrow">PRODUCT LIBRARY</span>
              <h1>一品牌，多产品</h1>
              <p>
                为每个产品建立独立、可交付的产品手册：产品定位、Logo、产品色、字体、素材与使用规范。
              </p>
            </div>
            <div className="product-index-stats">
              <div>
                <strong>{products.length}</strong>
                <span>产品总数</span>
              </div>
              <div>
                <strong>{activeCount}</strong>
                <span>在售</span>
              </div>
              <div>
                <strong>{needsWork}</strong>
                <span>待完善</span>
              </div>
            </div>
          </section>

          {products.length ? (
            <>
              <div className="product-toolbar">
                <label className="product-search">
                  <Search size={14} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索产品名称、分类或定位"
                    spellCheck={false}
                  />
                </label>
                <div className="product-status-filter">
                  <button
                    className={status === 'all' ? 'active' : ''}
                    onClick={() => setStatus('all')}
                  >
                    全部
                  </button>
                  {PRODUCT_STATUSES.map((item) => (
                    <button
                      key={item.value}
                      className={status === item.value ? 'active' : ''}
                      onClick={() => setStatus(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {visible.length ? (
                <div className="product-grid">
                  {visible.map(({ product, folderAssets, completion, cover }) => (
                    <article
                      className="product-card"
                      key={product.id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        useApp.getState().setNav({ type: 'product', productId: product.id })
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          useApp
                            .getState()
                            .setNav({ type: 'product', productId: product.id })
                        }
                      }}
                    >
                      <div className="product-card-cover">
                        {cover ? (
                          <img src={cover} alt={product.name} loading="lazy" />
                        ) : (
                          <span className="product-card-initial">
                            {(product.name || '产').trim().slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className={`product-status-chip status-${product.status}`}>
                          {productStatusLabel(product.status)}
                        </span>
                        <div className="product-card-tools">
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              editProduct(product)
                            }}
                            title="编辑产品"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              deleteProduct(product)
                            }}
                            title="删除产品"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="product-card-body">
                        <div className="product-card-title">
                          <div>
                            <h2>{product.name}</h2>
                            <span>
                              {product.category || '未设置分类'}
                              {product.sku ? ` · ${product.sku}` : ''}
                            </span>
                          </div>
                          <strong className="product-score">{completion.score}%</strong>
                        </div>
                        <p className="product-card-tagline">
                          {product.tagline || '还没有产品定位'}
                        </p>
                        <div className="product-card-meta">
                          <span>
                            <FolderOpen size={12} />
                            {folderAssets.length} 个素材
                          </span>
                          <span>{completion.requiredDone}/{completion.requiredTotal} 必填</span>
                        </div>
                        <div className="product-card-progress">
                          <span style={{ width: `${completion.score}%` }} />
                        </div>
                        <div className="product-card-footer">
                          {product.colors.length ? (
                            <span className="product-color-dots">
                              {product.colors.slice(0, 5).map((color) => (
                                <i
                                  key={color.id}
                                  style={{ background: color.hex }}
                                  title={color.name}
                                />
                              ))}
                            </span>
                          ) : (
                            <span className="muted">还没有产品色</span>
                          )}
                          <small>{formatDateTime(product.updatedAt)}</small>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="product-empty filtered">
                  <Search size={26} />
                  <h2>没有匹配的产品</h2>
                  <p>换一个关键词或清除状态筛选。</p>
                  <button
                    className="secondary-btn"
                    onClick={() => {
                      setQuery('')
                      setStatus('all')
                    }}
                  >
                    清除筛选
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="product-empty">
              <Package size={32} />
              <h2>从第一个产品开始</h2>
              <p>
                产品手册会继承品牌字体，并为每个产品单独维护 Logo、产品色、素材和规范。品牌下可以有很多产品。
              </p>
              <div className="product-empty-actions">
                <button className="primary-btn" onClick={createProduct}>
                  <Plus size={15} /> 新建产品
                </button>
                <button className="secondary-btn" onClick={importManual} disabled={importing}>
                  {importing ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
                  导入产品手册
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
