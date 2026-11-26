import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ExternalLink,
  Folder,
  HardDrive,
  Loader2,
  RefreshCw,
  Sparkles,
  X
} from 'lucide-react'
import { useApp } from '../store.js'
import api from '../api.js'
import { callApi, toast } from '../actions.js'
import { folderPath, flatFolders, formatBytes } from '../utils.js'

export function Modal({ children, onClose, width = 420 }) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-card" style={{ width }} onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function ConfirmDialog({ dialog, onClose }) {
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (busy) return
    setBusy(true)
    try {
      await dialog.onConfirm?.()
    } finally {
      setBusy(false)
      onClose()
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-head">
        <h2>{dialog.title || '确认操作'}</h2>
        <button className="icon-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <p className="modal-message">{dialog.message}</p>
      <div className="modal-actions">
        <button className="secondary-btn" onClick={onClose}>
          取消
        </button>
        <button className={dialog.danger ? 'danger-btn' : 'primary-btn'} onClick={confirm} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : null}
          {dialog.confirmLabel || '确定'}
        </button>
      </div>
    </Modal>
  )
}

function FolderDialog({ dialog, onClose }) {
  const editing = dialog.mode === 'rename'
  const [name, setName] = useState(editing ? dialog.folder?.name || '' : '')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event?.preventDefault()
    const value = name.trim()
    if (!value || busy) return
    setBusy(true)
    if (editing) {
      const result = await callApi(api.renameFolder(dialog.folder.id, value), '重命名失败')
      if (result) toast('文件夹已重命名', 'success')
    } else {
      const result = await callApi(api.createFolder(value, dialog.parentId || null), '新建文件夹失败')
      if (result) {
        const state = useApp.getState()
        if (dialog.parentId) state.expandFolder(dialog.parentId)
        state.toast('文件夹已创建', 'success')
      }
    }
    setBusy(false)
    onClose()
  }

  return (
    <Modal onClose={onClose} width={380}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>{editing ? '重命名文件夹' : '新建文件夹'}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <input
          className="modal-input"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="文件夹名称"
          maxLength={60}
          spellCheck={false}
        />
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-btn" disabled={!name.trim() || busy}>
            {busy ? <Loader2 size={15} className="spin" /> : null}
            {editing ? '保存' : '创建'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function MoveDialog({ dialog, onClose }) {
  const library = useApp((state) => state.library)
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const folders = flatFolders(library.folders)

  async function submit() {
    if (busy) return
    setBusy(true)
    const result = await callApi(
      api.batch(dialog.ids, 'move', target || null),
      '移动失败'
    )
    if (result) {
      const state = useApp.getState()
      state.clearSelection()
      state.toast(`已移动 ${result.count} 个素材`, 'success')
    }
    setBusy(false)
    onClose()
  }

  return (
    <Modal onClose={onClose} width={420}>
      <div className="modal-head">
        <h2>移动到文件夹</h2>
        <button className="icon-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="folder-picker">
        <button
          className={`folder-pick-row ${target === '' ? 'selected' : ''}`}
          onClick={() => setTarget('')}
        >
          <Folder size={15} />
          <span>未分类</span>
          {target === '' ? <Check size={14} className="check-icon" /> : null}
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            className={`folder-pick-row ${target === folder.id ? 'selected' : ''}`}
            style={{ paddingLeft: 12 + folder.depth * 16 }}
            onClick={() => setTarget(folder.id)}
          >
            <Folder size={15} />
            <span>{folder.name}</span>
            {target === folder.id ? <Check size={14} className="check-icon" /> : null}
          </button>
        ))}
        {!folders.length ? <p className="muted">还没有文件夹</p> : null}
      </div>
      <div className="modal-actions">
        <button className="secondary-btn" onClick={onClose}>
          取消
        </button>
        <button className="primary-btn" onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : null}
          移动 {dialog.ids.length} 个素材
        </button>
      </div>
    </Modal>
  )
}

function BatchTagDialog({ dialog, onClose }) {
  const library = useApp((state) => state.library)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  const suggestions = useMemo(() => {
    const tags = new Set()
    for (const asset of library.assets) {
      if (asset.trashed) continue
      for (const tag of asset.tags) tags.add(tag)
    }
    return [...tags].sort((a, b) => a.localeCompare(b, 'zh-CN')).slice(0, 30)
  }, [library.assets])

  async function submit(event) {
    event?.preventDefault()
    const tag = value.trim().replace(/^#/, '')
    if (!tag || busy) return
    setBusy(true)
    const result = await callApi(api.batch(dialog.ids, 'tag', tag), '添加标签失败')
    if (result) {
      useApp.getState().toast(`已为 ${result.count} 个素材添加标签「${tag}」`, 'success')
      useApp.getState().clearSelection()
    }
    setBusy(false)
    onClose()
  }

  return (
    <Modal onClose={onClose} width={400}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>批量添加标签</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="modal-message">为已选择的 {dialog.ids.length} 个素材添加同一个标签。</p>
        <input
          className="modal-input"
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="标签名称"
          maxLength={32}
          spellCheck={false}
        />
        {suggestions.length ? (
          <div className="suggestion-chips">
            {suggestions
              .filter((tag) => !value || tag.toLowerCase().includes(value.trim().toLowerCase()))
              .slice(0, 8)
              .map((tag) => (
                <button type="button" key={tag} onClick={() => setValue(tag)}>
                  {tag}
                </button>
              ))}
          </div>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-btn" disabled={!value.trim() || busy}>
            {busy ? <Loader2 size={15} className="spin" /> : null}
            添加标签
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DuplicatesDialog({ dialog, onClose }) {
  const library = useApp((state) => state.library)
  const items = Array.isArray(dialog.items) ? dialog.items : []
  const linkedCount = items.filter((item) => item.linked).length

  async function openExisting(item) {
    if (!item.assetId) return
    const result = await callApi(api.openExternal(item.assetId), '无法打开已有文件')
    if (result?.error) toast('没有可用的默认应用打开该文件', 'error')
  }

  function revealExisting(item) {
    if (!item.assetId) return
    callApi(api.reveal(item.assetId), '无法在 Finder 中显示')
  }

  return (
    <Modal onClose={onClose} width={540}>
      <div className="modal-head">
        <h2>检测到重复文件</h2>
        <button className="icon-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <p className="modal-message">
        以下文件已存在于当前品牌空间。
        {linkedCount
          ? `已在当前目录创建 ${linkedCount} 个快捷链接，不会重复占用存储。`
          : '已跳过导入。'}
        可以直接打开已有素材，或关闭后继续使用。
      </p>
      <div className="duplicate-list">
        {items.map((item, index) => {
          const asset = library.assets.find((entry) => entry.id === item.assetId)
          const folder = asset?.folderId
            ? library.folders.find((entry) => entry.id === asset.folderId)
            : null
          const location = asset?.trashed
            ? '回收站'
            : folder
              ? folderPath(library.folders, folder.id)
                  .map((entry) => entry.name)
                  .join(' / ')
              : '未分类'
          return (
            <div className="duplicate-row" key={`${item.assetId || 'missing'}-${index}`}>
              <div className="duplicate-copy">
                <button
                  className="duplicate-file-link"
                  onClick={() => openExisting(item)}
                  disabled={!asset}
                  title="打开已有文件"
                >
                  <ExternalLink size={12} />
                  <span>{asset?.name || '素材不可用'}</span>
                </button>
                <span>
                  位置：{location} · 新文件：{item.name}
                  {item.linked ? ' · 已创建快捷链接' : ''}
                </span>
                <span className="duplicate-file-actions">
                  <button onClick={() => openExisting(item)} disabled={!asset}>
                    打开文件
                  </button>
                  <button onClick={() => revealExisting(item)} disabled={!asset}>
                    在 Finder 中显示
                  </button>
                </span>
              </div>
            </div>
          )
        })}
        {!items.length ? <p className="muted">没有可显示的重复文件。</p> : null}
      </div>
      <div className="modal-actions">
        <button className="primary-btn" onClick={onClose}>
          知道了
        </button>
      </div>
    </Modal>
  )
}

function SpaceCreateDialog({ onClose }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const value = name.trim()
    if (!value || busy) return
    setBusy(true)
    const result = await callApi(api.createSpace(value), '创建品牌空间失败')
    setBusy(false)
    if (result) {
      toast('品牌空间已创建', 'success')
      onClose()
    }
  }

  return (
    <Modal onClose={onClose} width={380}>
      <form onSubmit={submit}>
        <div className="modal-head">
          <h2>新建品牌空间</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className="modal-message">
          每个品牌空间拥有独立的素材库、文件夹和品牌手册，数据仍保存在本机。
        </p>
        <input
          className="modal-input"
          name="space-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例如：主品牌 / 客户 A"
          maxLength={80}
          spellCheck={false}
        />
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-btn" disabled={!name.trim() || busy}>
            {busy ? <Loader2 size={15} className="spin" /> : null}
            创建空间
          </button>
        </div>
      </form>
    </Modal>
  )
}

function SettingsModal({ onClose }) {
  const library = useApp((state) => state.library)
  const [info, setInfo] = useState(null)
  const activeSpace =
    (library.spaces || []).find((space) => space.id === library.activeSpaceId) ||
    (library.spaces || [])[0] ||
    null
  const [spaceName, setSpaceName] = useState(activeSpace?.name || '')

  useEffect(() => {
    api.appInfo().then(setInfo).catch(() => {})
  }, [])

  async function renameSpace() {
    const value = spaceName.trim()
    if (!activeSpace || !value || value === activeSpace.name) return
    const result = await callApi(api.renameSpace(activeSpace.id, value), '重命名品牌空间失败')
    if (result) toast('品牌空间已重命名', 'success')
  }

  function requestDeleteSpace() {
    if (!activeSpace || (library.spaces || []).length <= 1) return
    useApp.getState().openDialog({
      type: 'confirm',
      title: '删除品牌空间',
      message: `将永久删除「${activeSpace.name}」及其 ${library.stats.total} 个素材和文件，此操作不可撤销。`,
      confirmLabel: '删除空间',
      danger: true,
      onConfirm: async () => {
        const result = await callApi(api.deleteSpace(activeSpace.id), '删除品牌空间失败')
        if (result) toast('品牌空间已删除', 'success')
      }
    })
  }

  async function rebuildPreviews() {
    const result = await callApi(api.rebuildPreviews(), '重建缩略图失败')
    if (result) toast(`已将 ${result.count} 个素材加入缩略图队列`)
  }

  async function rebuildAI() {
    const result = await callApi(api.rebuildAI(), '重跑 AI 解析失败')
    if (result) toast(`已将 ${result.count} 个素材加入 AI 队列`)
  }

  return (
    <Modal onClose={onClose} width={480}>
      <div className="modal-head">
        <h2>设置</h2>
        <button className="icon-btn" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="settings-brand">
        <div className="brand-mark">H</div>
        <div>
          <strong>HyBrand</strong>
          <span>版本 {info?.version || '0.6.1'} · 本地 AI 品牌资产工作台</span>
        </div>
      </div>

      {activeSpace ? (
        <div className="settings-block">
          <h3>品牌空间</h3>
          <div className="space-settings-row">
            <input
              className="modal-input"
              name="space-name-input"
              value={spaceName}
              onChange={(event) => setSpaceName(event.target.value)}
              maxLength={80}
            />
            <button
              className="secondary-btn"
              onClick={renameSpace}
              disabled={!spaceName.trim() || spaceName.trim() === activeSpace.name}
            >
              保存名称
            </button>
          </div>
          <div className="settings-stats">
            <span>{(library.spaces || []).length} 个品牌空间</span>
            <span>当前 {library.stats.total} 个素材</span>
          </div>
          <button
            className="text-danger"
            onClick={requestDeleteSpace}
            disabled={(library.spaces || []).length <= 1}
          >
            删除当前品牌空间
          </button>
          {(library.spaces || []).length <= 1 ? (
            <p className="section-note">至少保留一个品牌空间；新建后即可切换。</p>
          ) : null}
        </div>
      ) : null}

      <div className="settings-block">
        <h3>数据存储</h3>
        <p className="settings-path" title={info?.dataDir || library.dataDir}>
          {info?.dataDir || library.dataDir || '—'}
        </p>
        <div className="settings-stats">
          <span>{library.stats.active} 个素材</span>
          <span>{formatBytes(library.stats.bytes)}</span>
          <span>回收站 {library.stats.trash}</span>
        </div>
        <button className="secondary-btn" onClick={() => callApi(api.revealDataDir(), '无法打开数据目录')}>
          <HardDrive size={14} /> 打开数据目录
        </button>
      </div>

      <div className="settings-block">
        <h3>维护</h3>
        <div className="settings-actions">
          <button className="secondary-btn" onClick={rebuildPreviews}>
            <RefreshCw size={14} /> 重建缩略图
          </button>
          <button className="secondary-btn" onClick={rebuildAI}>
            <Sparkles size={14} /> 重跑 AI 解析
          </button>
        </div>
        <p className="section-note">
          所有文件与 AI 解析均保存在本机；关闭窗口或断网都不会丢失或影响使用。
        </p>
      </div>

      <div className="modal-actions">
        <button className="primary-btn" onClick={onClose}>
          完成
        </button>
      </div>
    </Modal>
  )
}

export default function Dialogs() {
  const dialog = useApp((state) => state.dialog)
  const closeDialog = useApp((state) => state.closeDialog)

  if (!dialog) return null

  if (dialog.type === 'confirm') {
    return <ConfirmDialog dialog={dialog} onClose={closeDialog} />
  }
  if (dialog.type === 'folder') {
    return <FolderDialog dialog={dialog} onClose={closeDialog} />
  }
  if (dialog.type === 'move') {
    return <MoveDialog dialog={dialog} onClose={closeDialog} />
  }
  if (dialog.type === 'batch-tag') {
    return <BatchTagDialog dialog={dialog} onClose={closeDialog} />
  }
  if (dialog.type === 'duplicates') {
    return <DuplicatesDialog dialog={dialog} onClose={closeDialog} />
  }
  if (dialog.type === 'space-create') {
    return <SpaceCreateDialog onClose={closeDialog} />
  }
  if (dialog.type === 'settings') {
    return <SettingsModal onClose={closeDialog} />
  }
  return null
}
