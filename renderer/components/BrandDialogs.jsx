import { useMemo, useState } from 'react'
import {
  Check,
  Image as ImageIcon,
  Loader2,
  Search,
  Type,
  X
} from 'lucide-react'
import { Modal } from './Dialogs.jsx'
import { useApp } from '../store.js'
import api from '../api.js'
import { callApi, toast } from '../actions.js'
import { cardImage } from '../utils.js'
import { colorValues, LOGO_ROLES, TYPE_ROLES } from '../brand.js'

function goToLibrary(onClose) {
  onClose()
  useApp.getState().setNav({ type: 'all' })
}

function BrandProfileDialog({ onClose }) {
  const brand = useApp((state) => state.library.brand)
  const [form, setForm] = useState({
    name: brand?.name || '',
    tagline: brand?.tagline || '',
    description: brand?.description || '',
    voice: brand?.voice || ''
  })
  const [busy, setBusy] = useState(false)

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    const result = await callApi(api.updateBrandProfile(form), '保存品牌信息失败')
    setBusy(false)
    if (result) {
      toast('品牌信息已保存', 'success')
      onClose()
    }
  }

  return (
    <Modal onClose={onClose} width={520}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>品牌信息</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="modal-message">
          这些内容会出现在品牌手册首页，并随品牌包一起导出。
        </p>
        <label className="brand-field">
          <span>品牌名称</span>
          <input
            autoFocus
            name="brand-name"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="例如：HyBrand"
            maxLength={80}
          />
        </label>
        <label className="brand-field">
          <span>一句话定位</span>
          <input
            name="brand-tagline"
            value={form.tagline}
            onChange={(event) => update('tagline', event.target.value)}
            placeholder="我们希望让团队一眼记住的一句话"
            maxLength={160}
          />
        </label>
        <label className="brand-field">
          <span>品牌简介</span>
          <textarea
            name="brand-description"
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder="品牌是做什么的、为谁服务、核心价值是什么"
            rows={3}
            maxLength={2000}
          />
        </label>
        <label className="brand-field">
          <span>品牌语气与使用原则</span>
          <textarea
            name="brand-voice"
            value={form.voice}
            onChange={(event) => update('voice', event.target.value)}
            placeholder="例如：克制、专业、不说空话；对外文案统一使用「我们」而不是「本品牌」"
            rows={4}
            maxLength={5000}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : null}
            保存
          </button>
        </div>
      </form>
    </Modal>
  )
}

function LogoDialog({ dialog, onClose }) {
  const library = useApp((state) => state.library)
  const variant = dialog.variant || null
  const candidates = useMemo(
    () =>
      library.assets
        .filter(
          (asset) =>
            !asset.trashed &&
            ['image', 'design', 'doc'].includes(asset.kind) &&
            (asset.previewPath || cardImage(asset))
        )
        .sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt))),
    [library.assets]
  )
  const initialAsset = candidates.find((asset) => asset.id === variant?.assetId)
  const [assetId, setAssetId] = useState(initialAsset?.id || '')
  const [role, setRole] = useState(variant?.role || dialog.role || 'primary')
  const [label, setLabel] = useState(variant?.label || '')
  const [minWidth, setMinWidth] = useState(variant?.minWidth || '')
  const [clearSpace, setClearSpace] = useState(variant?.clearSpace || '')
  const [note, setNote] = useState(variant?.note || '')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const filtered = candidates.filter((asset) =>
    asset.name.toLowerCase().includes(query.trim().toLowerCase())
  )
  const lostAsset = variant && !initialAsset

  function choose(asset) {
    setAssetId(asset.id)
    if (!label) setLabel(asset.name.replace(/\.[^.]+$/, ''))
  }

  async function submit(event) {
    event.preventDefault()
    if (!assetId || busy) return
    setBusy(true)
    const result = await callApi(
      api.saveBrandLogo({
        id: variant?.id,
        assetId,
        role,
        label,
        minWidth,
        clearSpace,
        note
      }),
      '保存 Logo 失败'
    )
    setBusy(false)
    if (result) {
      toast(variant ? 'Logo 变体已更新' : 'Logo 变体已添加', 'success')
      onClose()
    }
  }

  return (
    <Modal onClose={onClose} width={760}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>{variant ? '编辑 Logo 变体' : '添加 Logo 变体'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="modal-message">
          从素材库选择 Logo 文件，并补充使用规则。素材文件不会被修改。
        </p>
        {lostAsset ? (
          <p className="form-warning">原 Logo 素材已不可用，请重新选择。</p>
        ) : null}
        {candidates.length ? (
          <>
            <div className="picker-search">
              <Search size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索素材"
                spellCheck={false}
              />
            </div>
            <div className="logo-picker">
              {filtered.map((asset) => {
                const src = cardImage(asset)
                return (
                  <button
                    type="button"
                    key={asset.id}
                    className={`logo-pick ${assetId === asset.id ? 'selected' : ''}`}
                    onClick={() => choose(asset)}
                  >
                    <span className="logo-pick-preview">
                      {src ? <img src={src} alt={asset.name} /> : <ImageIcon size={20} />}
                    </span>
                    <span className="logo-pick-name" title={asset.name}>
                      {asset.name}
                    </span>
                    {assetId === asset.id ? (
                      <span className="logo-pick-check">
                        <Check size={11} />
                      </span>
                    ) : null}
                  </button>
                )
              })}
              {!filtered.length ? <p className="popover-empty">没有匹配的素材</p> : null}
            </div>
          </>
        ) : (
          <div className="picker-empty">
            <ImageIcon size={24} />
            <p>素材库里还没有可用的图片或设计文件。</p>
            <button type="button" className="secondary-btn" onClick={() => goToLibrary(onClose)}>
              前往素材库导入
            </button>
          </div>
        )}

        <div className="brand-form-grid">
          <label className="brand-field">
            <span>变体角色</span>
            <select name="logo-role" value={role} onChange={(event) => setRole(event.target.value)}>
              {LOGO_ROLES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="brand-field">
            <span>显示名称</span>
            <input
              name="logo-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="例如：主 Logo"
              maxLength={80}
            />
          </label>
          <label className="brand-field">
            <span>最小宽度</span>
            <input
              name="logo-min-width"
              value={minWidth}
              onChange={(event) => setMinWidth(event.target.value)}
              placeholder="例如：120px / 32mm"
              maxLength={60}
            />
          </label>
          <label className="brand-field">
            <span>安全边距</span>
            <input
              name="logo-clear-space"
              value={clearSpace}
              onChange={(event) => setClearSpace(event.target.value)}
              placeholder="例如：Logo 高度的 50%"
              maxLength={80}
            />
          </label>
          <label className="brand-field full">
            <span>使用说明</span>
            <textarea
              name="logo-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="例如：仅用于浅色背景，禁止描边或改变比例"
              rows={2}
              maxLength={500}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-btn" disabled={!assetId || busy}>
            {busy ? <Loader2 size={15} className="spin" /> : null}
            保存 Logo
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ColorDialog({ dialog, onClose }) {
  const color = dialog.color || null
  const [name, setName] = useState(color?.name || '品牌色')
  const [hex, setHex] = useState(color?.hex || '#5B6CFF')
  const [pantone, setPantone] = useState(color?.pantone || '')
  const [busy, setBusy] = useState(false)
  const valid = /^#[0-9a-f]{6}$/i.test(hex)
  const values = valid ? colorValues(hex) : null

  async function submit(event) {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    const result = await callApi(
      api.saveBrandColor({ id: color?.id, name, hex, pantone }),
      '保存品牌色失败'
    )
    setBusy(false)
    if (result) {
      toast(color ? '品牌色已更新' : '品牌色已添加', 'success')
      onClose()
    }
  }

  return (
    <Modal onClose={onClose} width={440}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>{color ? '编辑品牌色' : '添加品牌色'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="color-form-preview" style={{ background: valid ? hex : '#EEF0F6' }} />
        <label className="brand-field">
          <span>颜色名称</span>
          <input
            name="brand-color-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：主色"
            maxLength={40}
          />
        </label>
        <label className="brand-field">
          <span>颜色值</span>
          <div className="color-input-row">
            <input
              type="color"
              value={valid ? hex : '#5B6CFF'}
              onChange={(event) => setHex(event.target.value.toUpperCase())}
              aria-label="选择颜色"
            />
            <input
              name="color-hex"
              value={hex}
              onChange={(event) => setHex(event.target.value)}
              placeholder="#5B6CFF"
              spellCheck={false}
            />
          </div>
          {!valid ? <span className="form-error">请输入 #RRGGBB 格式的颜色</span> : null}
        </label>
        <label className="brand-field">
          <span>Pantone（可选）</span>
          <input
            name="brand-color-pantone"
            value={pantone}
            onChange={(event) => setPantone(event.target.value)}
            placeholder="例如：Pantone 2725 C"
            maxLength={40}
          />
        </label>
        {values ? (
          <div className="color-values">
            <div>
              <span>HEX</span>
              <strong>{values.hex}</strong>
            </div>
            <div>
              <span>RGB</span>
              <strong>{values.rgb}</strong>
            </div>
            <div>
              <span>HSL</span>
              <strong>{values.hsl}</strong>
            </div>
            <div>
              <span>CMYK</span>
              <strong>{values.cmyk}</strong>
            </div>
          </div>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-btn" disabled={!valid || busy}>
            {busy ? <Loader2 size={15} className="spin" /> : null}
            保存品牌色
          </button>
        </div>
      </form>
    </Modal>
  )
}

function TypefaceDialog({ dialog, onClose }) {
  const library = useApp((state) => state.library)
  const typeface = dialog.typeface || null
  const candidates = useMemo(
    () =>
      library.assets
        .filter((asset) => !asset.trashed && asset.kind === 'font')
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [library.assets]
  )
  const initialAsset = candidates.find((asset) => asset.id === typeface?.assetId)
  const [assetId, setAssetId] = useState(initialAsset?.id || '')
  const [role, setRole] = useState(typeface?.role || 'brand')
  const [name, setName] = useState(
    typeface?.name || initialAsset?.name.replace(/\.[^.]+$/, '') || ''
  )
  const [note, setNote] = useState(typeface?.note || '')
  const [sample, setSample] = useState(typeface?.sample || '')
  const [busy, setBusy] = useState(false)

  function choose(asset) {
    setAssetId(asset.id)
    if (!name) setName(asset.name.replace(/\.[^.]+$/, ''))
  }

  async function submit(event) {
    event.preventDefault()
    if (!assetId || busy) return
    setBusy(true)
    const result = await callApi(
      api.saveBrandTypeface({
        id: typeface?.id,
        assetId,
        role,
        name,
        note,
        sample
      }),
      '保存字体失败'
    )
    setBusy(false)
    if (result) {
      toast(typeface ? '字体已更新' : '字体已添加', 'success')
      onClose()
    }
  }

  return (
    <Modal onClose={onClose} width={560}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>{typeface ? '编辑品牌字体' : '添加品牌字体'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="modal-message">
          从素材库选择字体文件，补充字体角色与使用规则。
        </p>
        {typeface && !initialAsset ? (
          <p className="form-warning">原字体素材已不可用，请重新选择。</p>
        ) : null}
        {candidates.length ? (
          <div className="typeface-picker">
            {candidates.map((asset) => (
              <button
                type="button"
                key={asset.id}
                className={`typeface-option ${assetId === asset.id ? 'selected' : ''}`}
                onClick={() => choose(asset)}
              >
                <Type size={15} />
                <span>{asset.name}</span>
                <span className="typeface-ext">{String(asset.ext).toUpperCase()}</span>
                {assetId === asset.id ? <Check size={13} /> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="picker-empty">
            <Type size={24} />
            <p>素材库里还没有字体文件。</p>
            <button type="button" className="secondary-btn" onClick={() => goToLibrary(onClose)}>
              前往素材库导入
            </button>
          </div>
        )}

        <div className="brand-form-grid">
          <label className="brand-field">
            <span>字体角色</span>
            <select
              name="typeface-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {TYPE_ROLES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="brand-field">
            <span>显示名称</span>
            <input
              name="typeface-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：品牌标题字"
              maxLength={80}
            />
          </label>
          <label className="brand-field full">
            <span>字体样张</span>
            <input
              name="typeface-sample"
              value={sample}
              onChange={(event) => setSample(event.target.value)}
              placeholder="例如：让品牌被记住 Aa 0123"
              maxLength={200}
            />
          </label>
          <label className="brand-field full">
            <span>使用说明</span>
            <textarea
              name="typeface-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="例如：只用于标题，字重 600，不用于长正文"
              rows={2}
              maxLength={500}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-btn" disabled={!assetId || busy}>
            {busy ? <Loader2 size={15} className="spin" /> : null}
            保存字体
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function BrandDialogs() {
  const dialog = useApp((state) => state.dialog)
  const closeDialog = useApp((state) => state.closeDialog)

  if (!dialog) return null
  if (dialog.type === 'brand-profile') {
    return <BrandProfileDialog onClose={closeDialog} />
  }
  if (dialog.type === 'brand-logo') {
    return <LogoDialog dialog={dialog} onClose={closeDialog} />
  }
  if (dialog.type === 'brand-color') {
    return <ColorDialog dialog={dialog} onClose={closeDialog} />
  }
  if (dialog.type === 'brand-typeface') {
    return <TypefaceDialog dialog={dialog} onClose={closeDialog} />
  }
  return null
}
