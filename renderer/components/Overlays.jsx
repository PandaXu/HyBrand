import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  FolderUp,
  Hash,
  Info,
  Music,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useApp } from '../store.js'
import {
  assetUrl,
  cardImage,
  dimensionsOf,
  formatBytes,
  formatDateTime,
  isBrowserAudio,
  isBrowserVideo,
  KIND_LABELS,
  largeImage,
  previewUrl
} from '../utils.js'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function Lightbox({
  asset,
  assets,
  onNavigate,
  onClose,
  onFavorite,
  onDownload,
  onOpenExternal,
  onReveal,
  onTrash,
  onRestore,
  isTrash
}) {
  const index = assets.findIndex((item) => item.id === asset.id)
  const previous = index > 0 ? assets[index - 1] : null
  const next = index >= 0 && index < assets.length - 1 ? assets[index + 1] : null
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [failed, setFailed] = useState(false)
  const dragRef = useRef(null)
  const mediaRef = useRef(null)

  const isVideo = asset.kind === 'video'
  const isAudio = asset.kind === 'audio'
  const isVisual = !isVideo && !isAudio
  const imageSrc = largeImage(asset)
  const poster = previewUrl(asset)
  const playableVideo = isVideo && isBrowserVideo(asset.ext)
  const playableAudio = isAudio && isBrowserAudio(asset.ext)

  useEffect(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setFailed(false)
  }, [asset.id])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'ArrowLeft' && previous) onNavigate(previous.id)
      else if (event.key === 'ArrowRight' && next) onNavigate(next.id)
      else if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previous, next, onNavigate, onClose])

  useEffect(() => {
    const element = mediaRef.current
    if (!element) return undefined
    function onWheel(event) {
      if (!isVisual) return
      event.preventDefault()
      setScale((value) => clamp(value - Math.sign(event.deltaY) * 0.2, 1, 5))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [asset.id, isVisual])

  function zoomBy(delta) {
    setScale((value) => {
      const nextValue = clamp(value + delta, 1, 5)
      if (nextValue === 1) setOffset({ x: 0, y: 0 })
      return nextValue
    })
  }

  return (
    <div className="lightbox">
      <div className="lightbox-backdrop" onClick={onClose} />
      <header className="lightbox-top">
        <div className="lightbox-title">
          <strong>{asset.name}</strong>
          <span>
            {KIND_LABELS[asset.kind] || '素材'} · {formatBytes(asset.size)}
            {isVisual && dimensionsOf(asset) !== '—' ? ` · ${dimensionsOf(asset)}` : ''}
          </span>
        </div>
        <div className="lightbox-actions">
          <button
            className={`icon-btn light ${asset.favorite ? 'favorited' : ''}`}
            onClick={() => onFavorite(asset)}
            title={asset.favorite ? '取消收藏' : '收藏'}
          >
            <Star size={17} fill={asset.favorite ? 'currentColor' : 'none'} />
          </button>
          <button className="icon-btn light" onClick={() => onDownload(asset)} title="下载">
            <Download size={17} />
          </button>
          <button className="icon-btn light" onClick={() => onReveal(asset)} title="在 Finder 中显示">
            <FolderOpen size={17} />
          </button>
          <button
            className="icon-btn light"
            onClick={() => onOpenExternal(asset)}
            title="用默认应用打开"
          >
            <ExternalLink size={17} />
          </button>
          {isTrash ? (
            <button className="icon-btn light" onClick={() => onRestore(asset)} title="恢复">
              <RotateCcw size={17} />
            </button>
          ) : (
            <button className="icon-btn light" onClick={() => onTrash(asset)} title="移入回收站">
              <Trash2 size={17} />
            </button>
          )}
          <button className="icon-btn light" onClick={onClose} title="关闭">
            <X size={19} />
          </button>
        </div>
      </header>

      <button
        className="lightbox-nav prev"
        disabled={!previous}
        onClick={() => previous && onNavigate(previous.id)}
        aria-label="上一个"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="lightbox-stage" ref={mediaRef}>
        {isVideo ? (
          playableVideo ? (
            <video
              key={asset.id}
              className="lightbox-video"
              src={assetUrl(asset)}
              poster={poster || undefined}
              controls
              autoPlay
              muted
            />
          ) : poster && !failed ? (
            <img
              className="lightbox-image"
              src={poster}
              alt={asset.name}
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="lightbox-fallback">
              <Music size={42} />
              <span>该视频格式无法在内置播放器中打开</span>
            </div>
          )
        ) : isAudio ? (
          <div className="audio-stage">
            {poster ? <img src={poster} alt="" className="audio-cover" /> : <Music size={56} />}
            {playableAudio ? (
              <audio key={asset.id} src={assetUrl(asset)} controls autoPlay />
            ) : (
              <span>该音频格式无法在内置播放器中播放</span>
            )}
          </div>
        ) : imageSrc && !failed ? (
          <img
            className="lightbox-image"
            src={imageSrc}
            alt={asset.name}
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              cursor: scale > 1 ? 'grab' : 'default'
            }}
            onError={() => setFailed(true)}
            onPointerDown={(event) => {
              if (scale <= 1) return
              dragRef.current = {
                x: event.clientX - offset.x,
                y: event.clientY - offset.y
              }
              event.currentTarget.setPointerCapture(event.pointerId)
            }}
            onPointerMove={(event) => {
              if (!dragRef.current) return
              setOffset({
                x: event.clientX - dragRef.current.x,
                y: event.clientY - dragRef.current.y
              })
            }}
            onPointerUp={() => {
              dragRef.current = null
            }}
          />
        ) : (
          <div className="lightbox-fallback">
            <FolderOpen size={42} />
            <span>暂无可用预览</span>
            <button className="secondary-btn" onClick={() => onOpenExternal(asset)}>
              用默认应用打开
            </button>
          </div>
        )}
        {isVisual && asset.kind !== 'image' && imageSrc ? (
          <div className="preview-note">当前格式使用系统预览，原文件可用默认应用打开</div>
        ) : null}
      </div>

      <button
        className="lightbox-nav next"
        disabled={!next}
        onClick={() => next && onNavigate(next.id)}
        aria-label="下一个"
      >
        <ChevronRight size={22} />
      </button>

      {isVisual ? (
        <div className="lightbox-zoom">
          <button className="icon-btn light" onClick={() => zoomBy(-0.4)} title="缩小">
            <ZoomOut size={16} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button className="icon-btn light" onClick={() => zoomBy(0.4)} title="放大">
            <ZoomIn size={16} />
          </button>
        </div>
      ) : null}

      <footer className="lightbox-footer">
        <span>{formatDateTime(asset.importedAt)} 导入</span>
        <span>← → 切换 · 滚轮缩放 · Esc 关闭</span>
      </footer>
    </div>
  )
}

export function SelectionBar({
  count,
  isTrash,
  onFavorite,
  onMove,
  onTag,
  onTrash,
  onRestore,
  onDeleteForever,
  onClear
}) {
  return (
    <div className="selection-bar">
      <span className="selection-count">已选择 {count} 项</span>
      <div className="selection-actions">
        {!isTrash ? (
          <>
            <button onClick={onFavorite}>
              <Star size={15} /> 收藏
            </button>
            <button onClick={onMove}>
              <FolderOpen size={15} /> 移动
            </button>
            <button onClick={onTag}>
              <Hash size={15} /> 标签
            </button>
            <button className="danger" onClick={onTrash}>
              <Trash2 size={15} /> 回收站
            </button>
          </>
        ) : (
          <>
            <button onClick={onRestore}>
              <RotateCcw size={15} /> 恢复
            </button>
            <button className="danger" onClick={onDeleteForever}>
              <Trash2 size={15} /> 彻底删除
            </button>
          </>
        )}
      </div>
      <button className="icon-btn" onClick={onClear} title="取消选择">
        <X size={16} />
      </button>
    </div>
  )
}

export function Toasts() {
  const toasts = useApp((state) => state.toasts)
  const dismiss = useApp((state) => state.dismissToast)

  if (!toasts.length) return null

  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <div className={`toast ${toast.type}`} key={toast.id}>
          <span className="toast-icon">
            {toast.type === 'success' ? (
              <Check size={15} />
            ) : toast.type === 'error' ? (
              <AlertCircle size={15} />
            ) : (
              <Info size={15} />
            )}
          </span>
          <span className="toast-text">{toast.message}</span>
          {toast.action ? (
            <button
              className="toast-action"
              onClick={() => {
                toast.action.onClick?.()
                dismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
          <button className="toast-close" onClick={() => dismiss(toast.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  nav,
  search,
  filtersActive,
  similar,
  onPickImport,
  onPickFolder,
  onNewFolder,
  onClearFilters,
  onClearSearch,
  onClearSimilar
}) {
  if (similar) {
    return (
      <div className="empty-state">
        <div className="empty-art soft">
          <Search size={30} />
        </div>
        <h2>没有找到相似素材</h2>
        <p>换一张参考图试试，或者回到素材库继续浏览。</p>
        <div className="empty-actions">
          <button className="secondary-btn" onClick={onClearSimilar}>
            <X size={15} /> 清空搜索
          </button>
        </div>
      </div>
    )
  }

  if (search || filtersActive) {
    return (
      <div className="empty-state">
        <div className="empty-art soft">
          <Search size={30} />
        </div>
        <h2>没有找到匹配的素材</h2>
        <p>{search ? `没有与「${search}」匹配的结果。` : '当前筛选条件下没有素材。'}</p>
        <div className="empty-actions">
          {search ? (
            <button className="secondary-btn" onClick={onClearSearch}>
              <X size={15} /> 清除搜索
            </button>
          ) : null}
          {filtersActive ? (
            <button className="secondary-btn" onClick={onClearFilters}>
              清除筛选
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  if (nav.type === 'trash') {
    return (
      <div className="empty-state">
        <div className="empty-art soft">
          <Trash2 size={30} />
        </div>
        <h2>回收站是空的</h2>
        <p>被移除的素材会先放到这里，你可以随时恢复。</p>
      </div>
    )
  }

  if (nav.type === 'favorites') {
    return (
      <div className="empty-state">
        <div className="empty-art soft">
          <Star size={30} />
        </div>
        <h2>还没有收藏素材</h2>
        <p>在卡片上点击星标，常用素材就会出现在这里。</p>
      </div>
    )
  }

  if (nav.type === 'uncategorized') {
    return (
      <div className="empty-state">
        <div className="empty-art soft">
          <FolderOpen size={30} />
        </div>
        <h2>没有未分类素材</h2>
        <p>所有素材都已经归入文件夹。</p>
      </div>
    )
  }

  if (nav.type === 'folder') {
    return (
      <div className="empty-state">
        <div className="empty-art">
          <Sparkles size={30} />
        </div>
        <h2>这个文件夹还是空的</h2>
        <p>上传素材，或直接把文件拖进窗口。</p>
        <div className="empty-actions">
          <button className="primary-btn" onClick={onPickImport}>
            <Upload size={16} /> 上传文件
          </button>
          <button className="secondary-btn" onClick={onPickFolder}>
            <FolderUp size={16} /> 上传文件夹
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="empty-state onboarding">
      <div className="empty-art">
        <Sparkles size={34} />
      </div>
      <h2>把你的品牌素材集中到这里</h2>
      <p>
        图片、视频、设计源文件、文档……统一入库；AI 在本机自动解析和打标，
        无需上传云端。
      </p>
      <div className="empty-actions">
        <button className="primary-btn" onClick={onPickImport}>
          <Upload size={16} /> 上传文件
        </button>
        <button className="secondary-btn" onClick={onPickFolder}>
          <FolderUp size={16} /> 上传文件夹
        </button>
        <button className="secondary-btn" onClick={onNewFolder}>
          <FolderPlus size={16} /> 新建文件夹
        </button>
      </div>
      <span className="drop-hint">也可以直接把文件或文件夹拖进来 · 支持 90+ 格式</span>
    </div>
  )
}

export function SimilarHeader({ similar, referenceAsset, count = 0, onClear }) {
  const referenceSrc = referenceAsset
    ? cardImage(referenceAsset)
    : similar?.token
      ? `hybrand://temp/${similar.token}`
      : null
  const scope = similar?.scopeFolderId ? '当前文件夹' : '全部素材'

  return (
    <div className="similar-header">
      <div className="similar-reference">
        {referenceSrc ? <img src={referenceSrc} alt="" /> : <Search size={20} />}
      </div>
      <div className="similar-copy">
        <strong>{similar?.referenceId ? `与「${similar.name}」相似` : '以图搜图结果'}</strong>
        <span>
          在{scope}中找到 {count} 个结果
        </span>
      </div>
      <button className="secondary-btn small" onClick={onClear}>
        <X size={14} /> 清空搜索
      </button>
    </div>
  )
}

export function DragOverlay() {
  return (
    <div className="drag-overlay">
      <div className="drag-card">
        <Upload size={26} />
        <strong>松开以导入素材或文件夹</strong>
        <span>文件夹会保留目录结构，文件会复制到本地素材库</span>
      </div>
    </div>
  )
}
