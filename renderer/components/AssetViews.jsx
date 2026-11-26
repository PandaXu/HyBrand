import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Check,
  Download,
  ExternalLink,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  Loader2,
  MoreHorizontal,
  Music,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Type
} from 'lucide-react'
import {
  aspectOf,
  cardImage,
  dimensionsOf,
  extLabel,
  formatBytes,
  formatDate,
  formatDuration,
  KIND_LABELS
} from '../utils.js'
import { ASSET_MIME } from '../drop.js'

const THUMB_SIZES = { 1: 150, 2: 190, 3: 240 }
const ROW_HEIGHTS = { 1: 150, 2: 200, 3: 260 }

function kindIcon(kind, size = 22) {
  const props = { size }
  if (kind === 'image') return <ImageIcon {...props} />
  if (kind === 'video') return <Film {...props} />
  if (kind === 'audio') return <Music {...props} />
  if (kind === '3d') return <Box {...props} />
  if (kind === 'font') return <Type {...props} />
  return <FileText {...props} />
}

function CardMenu({ position, asset, isTrash, linked, onClose, actions }) {
  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="floating-menu card-menu" style={{ left: position.x, top: position.y }}>
        {linked ? (
          <button
            onClick={() => {
              onClose()
              actions.onUnlink(asset)
            }}
          >
            <Link2 size={14} /> 移除快捷链接
          </button>
        ) : null}
        <button
          onClick={() => {
            onClose()
            actions.onDownload(asset)
          }}
        >
          <Download size={14} /> 下载
        </button>
        <button
          onClick={() => {
            onClose()
            actions.onReveal(asset)
          }}
        >
          <FolderOpen size={14} /> 在 Finder 中显示
        </button>
        <button
          onClick={() => {
            onClose()
            actions.onOpenExternal(asset)
          }}
        >
          <ExternalLink size={14} /> 用默认应用打开
        </button>
        <div className="menu-separator" />
        {isTrash ? (
          <button
            onClick={() => {
              onClose()
              actions.onRestore(asset)
            }}
          >
            <RotateCcw size={14} /> 恢复
          </button>
        ) : (
          <button
            className="danger"
            onClick={() => {
              onClose()
              actions.onTrash(asset)
            }}
          >
            <Trash2 size={14} /> 移入回收站
          </button>
        )}
      </div>
    </>
  )
}

function AssetCard({
  asset,
  selected,
  active,
  selectionIds,
  onSelect,
  onCheck,
  onOpen,
  actions,
  isTrash,
  linked,
  style
}) {
  const src = cardImage(asset)
  const [failed, setFailed] = useState(false)
  const [menu, setMenu] = useState(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => setFailed(false), [src])

  const showImage = src && !failed

  function openMenu(event) {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(window.innerWidth - 186, Math.max(8, rect.right - 176))
    const y = Math.min(window.innerHeight - 220, rect.bottom + 4)
    setMenu({ x, y })
  }

  return (
    <>
      <div
        className={`asset-card ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''} ${
          active ? 'active' : ''
        }`}
        style={style}
        data-asset-card="true"
        data-active={active ? 'true' : 'false'}
        draggable
        onDragStart={(event) => {
          const ids = selectionIds.includes(asset.id) ? selectionIds : [asset.id]
          event.dataTransfer.setData(ASSET_MIME, JSON.stringify(ids))
          event.dataTransfer.effectAllowed = 'move'
          setDragging(true)
        }}
        onDragEnd={() => setDragging(false)}
        onClick={(event) => onSelect(asset.id, event)}
        onDoubleClick={() => onOpen(asset.id)}
        title={asset.name}
      >
        <div className="card-media">
          {showImage ? (
            <img
              src={src}
              alt={asset.name}
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
            />
          ) : (
            <div className={`file-fallback ${asset.status === 'processing' ? 'shimmer' : ''}`}>
              {kindIcon(asset.kind, 30)}
              <span>{extLabel(asset)}</span>
            </div>
          )}

          <button
            className={`card-check ${selected ? 'checked' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              onCheck(asset.id)
            }}
            aria-label={selected ? '取消选择' : '选择素材'}
          >
            {selected ? <Check size={12} /> : null}
          </button>

          <div className="card-actions">
            {!isTrash ? (
              <button
                className="card-action"
                title="搜相似"
                onClick={(event) => {
                  event.stopPropagation()
                  actions.onSimilar(asset)
                }}
              >
                <Search size={14} />
              </button>
            ) : null}
            <button
              className={`card-action ${asset.favorite ? 'favorited' : ''}`}
              title={asset.favorite ? '取消收藏' : '收藏'}
              onClick={(event) => {
                event.stopPropagation()
                actions.onFavorite(asset)
              }}
            >
              <Star size={14} fill={asset.favorite ? 'currentColor' : 'none'} />
            </button>
            <button className="card-action" title="更多" onClick={openMenu}>
              <MoreHorizontal size={15} />
            </button>
          </div>

          {linked ? (
            <span className="shortcut-badge" title="此素材是当前文件夹的快捷链接">
              <Link2 size={10} /> 快捷链接
            </span>
          ) : null}
          <span className="format-badge">{extLabel(asset)}</span>
          {asset.duration ? (
            <span className="duration-badge">{formatDuration(asset.duration)}</span>
          ) : null}
          {asset.status === 'processing' ? (
            <span className="processing-badge">
              <Loader2 size={12} className="spin" />
            </span>
          ) : null}

          <div className="card-hover-footer">
            <span className="card-name">{asset.name}</span>
            <span className="card-meta">
              {KIND_LABELS[asset.kind] || '素材'} · {formatBytes(asset.size)}
            </span>
          </div>
        </div>
      </div>

      {menu ? (
        <CardMenu
          position={menu}
          asset={asset}
          isTrash={isTrash}
          linked={linked}
          onClose={() => setMenu(null)}
          actions={actions}
        />
      ) : null}
    </>
  )
}

function ListRow({
  asset,
  selected,
  active,
  selectionIds,
  onSelect,
  onCheck,
  onOpen,
  actions,
  isTrash,
  linked
}) {
  const src = cardImage(asset)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])

  return (
    <div
      className={`list-row ${selected ? 'selected' : ''} ${active ? 'active' : ''}`}
      data-asset-card="true"
      data-active={active ? 'true' : 'false'}
      draggable
      onDragStart={(event) => {
        const ids = selectionIds.includes(asset.id) ? selectionIds : [asset.id]
        event.dataTransfer.setData(ASSET_MIME, JSON.stringify(ids))
        event.dataTransfer.effectAllowed = 'move'
      }}
      onClick={(event) => onSelect(asset.id, event)}
      onDoubleClick={() => onOpen(asset.id)}
    >
      <button
        className={`checkbox ${selected ? 'checked' : ''}`}
        onClick={(event) => {
          event.stopPropagation()
          onCheck(asset.id)
        }}
        aria-label={selected ? '取消选择' : '选择素材'}
      >
        {selected ? <Check size={11} /> : null}
      </button>

      <div className="list-thumb">
        {src && !failed ? (
          <img
            src={src}
            alt={asset.name}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="list-thumb-fallback">{kindIcon(asset.kind, 16)}</div>
        )}
      </div>

      <div className="list-name">
        <strong>{asset.name}</strong>
        {linked ? (
          <span className="shortcut-chip">
            <Link2 size={10} /> 快捷链接
          </span>
        ) : null}
        {asset.note ? <span>{asset.note}</span> : null}
      </div>
      <span className="list-kind">{KIND_LABELS[asset.kind] || '素材'}</span>
      <span className="list-size">{formatBytes(asset.size)}</span>
      <span className="list-dims">{dimensionsOf(asset)}</span>
      <span className="list-date">{formatDate(asset.updatedAt)}</span>

      <div className="list-actions">
        <button
          className={`icon-btn tiny ${asset.favorite ? 'favorited' : ''}`}
          onClick={(event) => {
            event.stopPropagation()
            actions.onFavorite(asset)
          }}
          title={asset.favorite ? '取消收藏' : '收藏'}
        >
          <Star size={14} fill={asset.favorite ? 'currentColor' : 'none'} />
        </button>
        {linked ? (
          <button
            className="icon-btn tiny"
            onClick={(event) => {
              event.stopPropagation()
              actions.onUnlink(asset)
            }}
            title="移除快捷链接"
          >
            <Link2 size={14} />
          </button>
        ) : null}
        {isTrash ? (
          <button
            className="icon-btn tiny"
            onClick={(event) => {
              event.stopPropagation()
              actions.onRestore(asset)
            }}
            title="恢复"
          >
            <RotateCcw size={14} />
          </button>
        ) : (
          <button
            className="icon-btn tiny"
            onClick={(event) => {
              event.stopPropagation()
              actions.onTrash(asset)
            }}
            title="移入回收站"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

function useContainerWidth(ref, active) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!active || !ref.current) return undefined
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width)
    })
    observer.observe(ref.current)
    setWidth(ref.current.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [ref, active])
  return width
}

function buildMasonryColumns(assets, width, thumbSize) {
  const target = THUMB_SIZES[thumbSize] || 190
  const gap = 16
  const count = width ? Math.max(1, Math.floor((width + gap) / (target + gap))) : 3
  const columns = Array.from({ length: count }, () => [])
  const heights = new Array(count).fill(0)

  for (const asset of assets) {
    let index = 0
    for (let i = 1; i < count; i += 1) {
      if (heights[i] < heights[index]) index = i
    }
    columns[index].push(asset)
    heights[index] += 1 / Math.max(0.2, aspectOf(asset))
  }

  return columns
}

function buildJustifiedRows(assets, width, targetHeight, gap = 16) {
  if (!width) return []
  const rows = []
  let current = []
  let aspectSum = 0

  for (const asset of assets) {
    current.push(asset)
    aspectSum += aspectOf(asset)
    const naturalWidth = aspectSum * targetHeight + (current.length - 1) * gap
    if (naturalWidth >= width) {
      const height = (width - (current.length - 1) * gap) / aspectSum
      rows.push({ items: current, height: Math.min(height, targetHeight * 2.4) })
      current = []
      aspectSum = 0
    }
  }
  if (current.length) rows.push({ items: current, height: targetHeight })
  return rows
}

export default function AssetViews({
  assets,
  viewMode,
  thumbSize,
  selection,
  activeId,
  onSelect,
  onCheck,
  onOpen,
  onFavorite,
  onSimilar,
  onDownload,
  onReveal,
  onOpenExternal,
  onTrash,
  onRestore,
  onUnlink,
  isTrash,
  linkedIds
}) {
  const selectionSet = useMemo(() => new Set(selection), [selection])
  const actions = {
    onFavorite,
    onSimilar,
    onDownload,
    onReveal,
    onOpenExternal,
    onTrash,
    onRestore,
    onUnlink
  }
  const containerRef = useRef(null)
  const containerWidth = useContainerWidth(containerRef, viewMode === 'adaptive')
  const masonryRef = useRef(null)
  const masonryWidth = useContainerWidth(masonryRef, viewMode === 'masonry')

  if (viewMode === 'list') {
    return (
      <div className="list-view">
        <div className="list-header">
          <span className="list-header-check" />
          <span className="list-header-thumb" />
          <span>名称</span>
          <span>类型</span>
          <span>大小</span>
          <span>尺寸</span>
          <span>修改时间</span>
          <span />
        </div>
        {assets.map((asset) => (
          <ListRow
            key={asset.id}
            asset={asset}
            selected={selectionSet.has(asset.id)}
            active={activeId === asset.id}
            selectionIds={selection}
            onSelect={onSelect}
            onCheck={onCheck}
            onOpen={onOpen}
            actions={actions}
            isTrash={isTrash}
            linked={linkedIds.has(asset.id)}
          />
        ))}
      </div>
    )
  }

  if (viewMode === 'adaptive') {
    const rows = buildJustifiedRows(assets, containerWidth, ROW_HEIGHTS[thumbSize] || 200)
    return (
      <div className="adaptive-view" ref={containerRef}>
        {rows.map((row, rowIndex) => (
          <div className="adaptive-row" key={`row-${rowIndex}`} style={{ height: row.height }}>
            {row.items.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={selectionSet.has(asset.id)}
                active={activeId === asset.id}
                selectionIds={selection}
                onSelect={onSelect}
                onCheck={onCheck}
                onOpen={onOpen}
                actions={actions}
                isTrash={isTrash}
                linked={linkedIds.has(asset.id)}
                style={{ width: Math.max(60, aspectOf(asset) * row.height) }}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (viewMode === 'masonry') {
    const columns = buildMasonryColumns(assets, masonryWidth, thumbSize)
    return (
      <div className="masonry-view" ref={masonryRef}>
        {columns.map((column, columnIndex) => (
          <div className="masonry-column" key={columnIndex}>
            {column.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                selected={selectionSet.has(asset.id)}
                active={activeId === asset.id}
                selectionIds={selection}
                onSelect={onSelect}
                onCheck={onCheck}
                onOpen={onOpen}
                actions={actions}
                isTrash={isTrash}
                linked={linkedIds.has(asset.id)}
                style={{ aspectRatio: aspectOf(asset) }}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className="grid-view"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB_SIZES[thumbSize] || 190}px, 1fr))` }}
    >
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          selected={selectionSet.has(asset.id)}
          active={activeId === asset.id}
          selectionIds={selection}
          onSelect={onSelect}
          onCheck={onCheck}
          onOpen={onOpen}
          actions={actions}
          isTrash={isTrash}
          linked={linkedIds.has(asset.id)}
        />
      ))}
    </div>
  )
}
