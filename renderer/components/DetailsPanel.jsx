import { useState } from 'react'
import {
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  X
} from 'lucide-react'
import api from '../api.js'
import { callApi, toast } from '../actions.js'
import {
  aiTagName,
  cardImage,
  dimensionsOf,
  extLabel,
  flatFolders,
  formatBytes,
  formatDateTime,
  formatDuration,
  KIND_LABELS
} from '../utils.js'

function TagInput({ value, suggestions, onChange }) {
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)

  const query = input.trim().replace(/^#/, '').toLowerCase()
  const matches = suggestions
    .filter((tag) => !value.includes(tag) && tag.toLowerCase().includes(query))
    .slice(0, 6)

  function addTag(raw) {
    const tag = String(raw || '').trim().replace(/^#/, '')
    if (!tag) return
    if (!value.includes(tag)) onChange([...value, tag])
    setInput('')
  }

  return (
    <div className="tag-input">
      <div className="tag-chips">
        {value.map((tag) => (
          <span className="tag-chip" key={tag}>
            {tag}
            <button
              onClick={() => onChange(value.filter((item) => item !== tag))}
              aria-label={`移除标签 ${tag}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={input}
          placeholder="添加标签…"
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              addTag(input)
            } else if (event.key === 'Backspace' && !input && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          spellCheck={false}
        />
      </div>
      {focused && query && matches.length ? (
        <div className="tag-suggestions">
          {matches.map((tag) => (
            <button
              key={tag}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Comments({ asset }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    const result = await callApi(api.addComment(asset.id, value), '发表评论失败')
    setBusy(false)
    if (result) setText('')
  }

  async function remove(commentId) {
    await callApi(api.deleteComment(asset.id, commentId), '删除评论失败')
  }

  return (
    <div className="comments">
      {asset.comments.length ? (
        <div className="comment-list">
          {asset.comments.map((comment) => (
            <div className="comment" key={comment.id}>
              <div className="avatar">我</div>
              <div className="comment-body">
                <div className="comment-meta">
                  <strong>{comment.author}</strong>
                  <span>{formatDateTime(comment.createdAt)}</span>
                  <button
                    className="comment-delete"
                    onClick={() => remove(comment.id)}
                    title="删除评论"
                  >
                    <X size={12} />
                  </button>
                </div>
                <p>{comment.text}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">还没有评论，写下你的想法吧。</p>
      )}
      <form className="comment-composer" onSubmit={submit}>
        <div className="avatar">我</div>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="添加评论…"
        />
        <button type="submit" className="icon-btn" disabled={!text.trim() || busy} title="发送">
          {busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
        </button>
      </form>
    </div>
  )
}

export default function DetailsPanel({
  asset,
  folders,
  allTags,
  onClose,
  onLightbox,
  onFavorite,
  onDownload,
  onReveal,
  onOpenExternal,
  onSimilar,
  onTrash,
  onRestore,
  isTrash
}) {
  const [name, setName] = useState(asset.name)
  const [note, setNote] = useState(asset.note || '')
  const [tags, setTags] = useState(asset.tags || [])
  const [folderId, setFolderId] = useState(asset.folderId || '')
  const [previewFailed, setPreviewFailed] = useState(false)

  const src = cardImage(asset)
  const folderTree = flatFolders(folders)
  const tagSuggestions = allTags.map((tag) => tag.value)

  async function saveName() {
    const value = name.trim()
    if (!value) {
      setName(asset.name)
      return
    }
    if (value === asset.name) return
    const result = await callApi(api.updateAsset(asset.id, { name: value }), '重命名失败')
    if (!result) setName(asset.name)
  }

  async function saveNote() {
    if (note === (asset.note || '')) return
    await callApi(api.updateAsset(asset.id, { note }), '保存备注失败')
  }

  function updateTags(next) {
    setTags(next)
    callApi(api.updateAsset(asset.id, { tags: next }), '更新标签失败')
  }

  function updateFolder(value) {
    setFolderId(value)
    callApi(api.updateAsset(asset.id, { folderId: value || null }), '移动失败')
  }

  async function refreshAI() {
    const result = await callApi(api.reanalyze(asset.id), '重新解析失败')
    if (result?.ok) toast('已开始重新解析')
  }

  return (
    <aside className="details-panel">
      <div className="details-head">
        <span>素材详情</span>
        <button className="icon-btn" onClick={onClose} title="收起详情">
          <X size={16} />
        </button>
      </div>

      <div className="details-scroll">
        <button className="details-preview" onClick={onLightbox} title="全屏预览">
          {src && !previewFailed ? (
            <img src={src} alt={asset.name} onError={() => setPreviewFailed(true)} />
          ) : (
            <div className="details-preview-fallback">
              <FileText size={32} />
              <span>{extLabel(asset)}</span>
            </div>
          )}
          <span className="details-zoom-hint">点击全屏预览</span>
        </button>

        <div className="details-title-row">
          <input
            className="name-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={saveName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                setName(asset.name)
                event.currentTarget.blur()
              }
            }}
            spellCheck={false}
          />
          <button
            className={`icon-btn ${asset.favorite ? 'favorited' : ''}`}
            onClick={() => onFavorite(asset)}
            title={asset.favorite ? '取消收藏' : '收藏'}
          >
            <Star size={17} fill={asset.favorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="details-actions">
          <button className="secondary-btn small" onClick={() => onDownload(asset)}>
            <Download size={14} /> 下载
          </button>
          <button className="secondary-btn small" onClick={() => onOpenExternal(asset)}>
            <ExternalLink size={14} /> 打开
          </button>
          <button className="secondary-btn small" onClick={() => onReveal(asset)}>
            <FolderOpen size={14} /> Finder
          </button>
        </div>

        <section className="detail-section">
          <h3>文件信息</h3>
          <dl className="meta-grid">
            <dt>格式</dt>
            <dd>{extLabel(asset)}</dd>
            <dt>类型</dt>
            <dd>{KIND_LABELS[asset.kind] || '素材'}</dd>
            <dt>大小</dt>
            <dd>{formatBytes(asset.size)}</dd>
            <dt>尺寸</dt>
            <dd>{dimensionsOf(asset)}</dd>
            {asset.duration ? (
              <>
                <dt>时长</dt>
                <dd>{formatDuration(asset.duration)}</dd>
              </>
            ) : null}
            <dt>导入</dt>
            <dd>{formatDateTime(asset.importedAt)}</dd>
            <dt>修改</dt>
            <dd>{formatDateTime(asset.updatedAt)}</dd>
          </dl>
        </section>

        <section className="detail-section">
          <h3>备注</h3>
          <textarea
            className="note-input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={saveNote}
            rows={3}
            placeholder="补充用途、来源或拍摄信息…"
          />
        </section>

        <section className="detail-section">
          <h3>颜色</h3>
          {asset.colors.length ? (
            <div className="color-swatches">
              {asset.colors.map((color) => (
                <span
                  key={color}
                  className="color-swatch"
                  style={{ background: color }}
                  title={color}
                />
              ))}
              <span className="muted small">{asset.colors[0]}</span>
            </div>
          ) : (
            <p className="muted">暂未提取</p>
          )}
        </section>

        <section className="detail-section">
          <h3>所属文件夹</h3>
          <select
            className="folder-select"
            value={folderId}
            onChange={(event) => updateFolder(event.target.value)}
          >
            <option value="">未分类</option>
            {folderTree.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {'　'.repeat(folder.depth)}
                {folder.name}
              </option>
            ))}
          </select>
        </section>

        <section className="detail-section">
          <h3>标签</h3>
          <TagInput value={tags} suggestions={tagSuggestions} onChange={updateTags} />
        </section>

        <section className="detail-section">
          <div className="section-title-row">
            <h3>
              <Sparkles size={14} /> AI 智能标签
            </h3>
            <button
              className="icon-btn tiny"
              onClick={refreshAI}
              disabled={asset.status === 'processing'}
              title="重新解析"
            >
              {asset.status === 'processing' ? (
                <Loader2 size={13} className="spin" />
              ) : (
                <RefreshCw size={13} />
              )}
            </button>
          </div>
          {asset.aiTags.length ? (
            <div className="ai-tags">
              {asset.aiTags.map((tag) => (
                <span
                  className="ai-tag"
                  key={tag.label}
                  title={`置信度 ${Math.round((tag.score || 0) * 100)}%`}
                >
                  {aiTagName(tag)}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">
              {asset.status === 'processing' ? '正在本机解析…' : '暂无 AI 标签'}
            </p>
          )}
          <p className="section-note">由 macOS Vision 在本机离线生成</p>
        </section>

        <section className="detail-section">
          <h3>相似素材</h3>
          <button
            className="secondary-btn full"
            onClick={() => onSimilar(asset)}
            disabled={!asset.featurePath || asset.status === 'processing'}
          >
            <Search size={14} /> 查找相似素材
          </button>
        </section>

        <section className="detail-section">
          <h3>
            评论 <span className="muted">{asset.comments.length}</span>
          </h3>
          <Comments asset={asset} />
        </section>

        <div className="details-danger">
          {isTrash ? (
            <button className="text-danger" onClick={() => onRestore(asset)}>
              <RotateCcw size={14} /> 恢复素材
            </button>
          ) : (
            <button className="text-danger" onClick={() => onTrash(asset)}>
              <Trash2 size={14} /> 移入回收站
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
