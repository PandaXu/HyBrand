import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  HardDrive,
  Hash,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  Star,
  Trash2
} from 'lucide-react'
import { useApp } from '../store.js'
import { formatBytes } from '../utils.js'
import { brandCompletion } from '../brand.js'
import {
  hasFiles,
  hasInternalAssets,
  readAssetIds,
  readFilePaths
} from '../drop.js'

function NavItem({ icon: Icon, label, count, active, onClick }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <Icon size={16} />
      <span className="nav-label">{label}</span>
      {typeof count === 'number' ? <span className="nav-count">{count}</span> : null}
    </button>
  )
}

function FolderNode({
  folder,
  depth,
  library,
  nav,
  countsByFolder,
  onNavigate,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveAssets,
  onImportToFolder
}) {
  const expanded = useApp((state) => state.expandedFolders.includes(folder.id))
  const toggleFolder = useApp((state) => state.toggleFolder)
  const [menu, setMenu] = useState(null)
  const [dropActive, setDropActive] = useState(false)

  const children = library.folders
    .filter((item) => item.parentId === folder.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  const count = countsByFolder.get(folder.id) || 0
  const active = nav.type === 'folder' && nav.id === folder.id

  function openMenu(event) {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    setMenu({ x: Math.max(12, rect.right - 148), y: rect.bottom + 4 })
  }

  return (
    <>
      <div
        className={`folder-row ${active ? 'active' : ''} ${dropActive ? 'drop-active' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onNavigate({ type: 'folder', id: folder.id })}
        onDragOver={(event) => {
          if (!hasInternalAssets(event.dataTransfer) && !hasFiles(event.dataTransfer)) return
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = hasFiles(event.dataTransfer) ? 'copy' : 'move'
          setDropActive(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDropActive(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setDropActive(false)
          const assetIds = readAssetIds(event.dataTransfer)
          const paths = readFilePaths(event.dataTransfer)
          if (assetIds.length) onMoveAssets(assetIds, folder.id)
          if (paths.length) onImportToFolder(paths, folder.id)
        }}
      >
        <button
          className="tree-chevron"
          onClick={(event) => {
            event.stopPropagation()
            toggleFolder(folder.id)
          }}
          aria-label={expanded ? '收起文件夹' : '展开文件夹'}
        >
          {children.length ? (
            expanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : (
            <span className="chevron-spacer" />
          )}
        </button>
        <Folder size={15} className="folder-icon" />
        <span className="folder-name" title={folder.name}>
          {folder.name}
        </span>
        <span className="nav-count">{count}</span>
        <button className="row-more" onClick={openMenu} aria-label="文件夹操作">
          <MoreHorizontal size={14} />
        </button>
      </div>

      {expanded && children.length
        ? children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              library={library}
              nav={nav}
              countsByFolder={countsByFolder}
              onNavigate={onNavigate}
              onNewFolder={onNewFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onMoveAssets={onMoveAssets}
              onImportToFolder={onImportToFolder}
            />
          ))
        : null}

      {menu ? (
        <>
          <div className="menu-backdrop" onClick={() => setMenu(null)} />
          <div className="floating-menu folder-menu" style={{ left: menu.x, top: menu.y }}>
            <button
              onClick={() => {
                setMenu(null)
                onNewFolder(folder.id)
              }}
            >
              <Plus size={14} /> 新建子文件夹
            </button>
            <button
              onClick={() => {
                setMenu(null)
                onRenameFolder(folder)
              }}
            >
              重命名
            </button>
            <div className="menu-separator" />
            <button
              className="danger"
              onClick={() => {
                setMenu(null)
                onDeleteFolder(folder)
              }}
            >
              <Trash2 size={14} /> 删除文件夹
            </button>
          </div>
        </>
      ) : null}
    </>
  )
}

export default function Sidebar({
  library,
  nav,
  counts,
  countsByFolder,
  manualTags,
  filters,
  onNavigate,
  onToggleTag,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveAssets,
  onImportToFolder,
  onOpenSettings
}) {
  const rootFolders = library.folders
    .filter((folder) => !folder.parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  const brandScore = brandCompletion(library.brand, library.assets).score

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand">
          <div className="brand-mark">H</div>
          <div className="brand-copy">
            <strong>HyBrand</strong>
            <span>本地品牌工作台</span>
          </div>
        </div>
      </div>

      <div className="sidebar-scroll">
        <nav className="sidebar-nav">
          <button
            className={`nav-item brand-nav ${nav.type === 'brand' ? 'active' : ''}`}
            onClick={() => onNavigate({ type: 'brand' })}
          >
            <Sparkles size={16} />
            <span className="nav-label">品牌手册</span>
            <span className="nav-count">{brandScore > 0 ? `${brandScore}%` : '新建'}</span>
          </button>
          <NavItem
            icon={LayoutGrid}
            label="全部素材"
            count={counts.all}
            active={nav.type === 'all'}
            onClick={() => onNavigate({ type: 'all' })}
          />
          <NavItem
            icon={FolderOpen}
            label="未分类"
            count={counts.uncategorized}
            active={nav.type === 'uncategorized'}
            onClick={() => onNavigate({ type: 'uncategorized' })}
          />
          <NavItem
            icon={Star}
            label="收藏"
            count={counts.favorites}
            active={nav.type === 'favorites'}
            onClick={() => onNavigate({ type: 'favorites' })}
          />
          <NavItem
            icon={Trash2}
            label="回收站"
            count={counts.trash}
            active={nav.type === 'trash'}
            onClick={() => onNavigate({ type: 'trash' })}
          />
        </nav>

        <div className="sidebar-section">
          <div className="section-head">
            <span>文件夹</span>
            <button
              className="icon-btn tiny"
              onClick={() => onNewFolder(null)}
              title="新建文件夹"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="folder-tree">
            {rootFolders.map((folder) => (
              <FolderNode
                key={folder.id}
                folder={folder}
                depth={0}
                library={library}
                nav={nav}
                countsByFolder={countsByFolder}
                onNavigate={onNavigate}
                onNewFolder={onNewFolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                onMoveAssets={onMoveAssets}
                onImportToFolder={onImportToFolder}
              />
            ))}
            {!rootFolders.length ? <div className="sidebar-empty">暂无文件夹</div> : null}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="section-head">
            <span>标签</span>
          </div>
          <div className="sidebar-tags">
            {manualTags.map((tag) => (
              <button
                key={tag.value}
                className={`tag-nav ${filters.tags.includes(tag.value) ? 'active' : ''}`}
                onClick={() => onToggleTag(tag.value)}
                title={tag.value}
              >
                <Hash size={13} />
                <span>{tag.value}</span>
                <span className="nav-count">{tag.count}</span>
              </button>
            ))}
            {!manualTags.length ? <div className="sidebar-empty">暂无标签</div> : null}
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="storage-info">
          <HardDrive size={15} />
          <div>
            <span>本地存储</span>
            <strong>{formatBytes(library.stats.bytes)}</strong>
          </div>
        </div>
        <button className="icon-btn" onClick={onOpenSettings} title="设置">
          <Settings size={16} />
        </button>
      </div>
    </aside>
  )
}
