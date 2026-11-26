import { useState } from 'react'
import {
  Camera,
  ChevronRight,
  FolderPlus,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import { folderPath } from '../utils.js'

export default function TopBar({
  library,
  nav,
  similar,
  search,
  searchRef,
  visibleCount,
  onSearch,
  onNavigate,
  onPickImport,
  onNewFolder,
  onSearchByImage,
  onEmptyTrash
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [cameraBusy, setCameraBusy] = useState(false)

  const crumbs = []
  if (similar) {
    crumbs.push({ label: '相似图片' })
  } else if (nav.type === 'folder') {
    const path = folderPath(library.folders, nav.id)
    if (path.length) {
      crumbs.push({ label: '全部素材', nav: { type: 'all' } })
      path.forEach((folder, index) => {
        crumbs.push({
          label: folder.name,
          nav: index === path.length - 1 ? null : { type: 'folder', id: folder.id }
        })
      })
    } else {
      crumbs.push({ label: '全部素材' })
    }
  } else if (nav.type === 'uncategorized') {
    crumbs.push({ label: '未分类' })
  } else if (nav.type === 'favorites') {
    crumbs.push({ label: '收藏' })
  } else if (nav.type === 'trash') {
    crumbs.push({ label: '回收站' })
  } else {
    crumbs.push({ label: '全部素材' })
  }

  async function handleCamera() {
    if (cameraBusy) return
    setCameraBusy(true)
    try {
      await onSearchByImage()
    } finally {
      setCameraBusy(false)
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="breadcrumb">
          {crumbs.map((crumb, index) => (
            <span className="crumb-wrap" key={`${crumb.label}-${index}`}>
              {index > 0 ? <ChevronRight size={13} className="crumb-sep" /> : null}
              {crumb.nav ? (
                <button className="crumb link" onClick={() => onNavigate(crumb.nav)}>
                  {crumb.label}
                </button>
              ) : (
                <span className="crumb current">{crumb.label}</span>
              )}
            </span>
          ))}
        </div>
        {similar ? null : <span className="toolbar-count">共 {visibleCount} 个素材</span>}
      </div>

      <div className="topbar-right">
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <input
            ref={searchRef}
            className="search-input"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="搜索名称、标签、备注"
            spellCheck={false}
          />
          {search ? (
            <button className="search-clear" onClick={() => onSearch('')} aria-label="清空搜索">
              <X size={13} />
            </button>
          ) : (
            <kbd className="search-hint">⌘K</kbd>
          )}
        </div>

        <button
          className="icon-btn camera-btn"
          onClick={handleCamera}
          title="以图搜图"
          disabled={cameraBusy}
        >
          {cameraBusy ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}
        </button>

        {nav.type === 'trash' ? (
          library.stats.trash > 0 ? (
            <button className="subtle-danger-btn" onClick={onEmptyTrash}>
              <Trash2 size={15} /> 清空回收站
            </button>
          ) : null
        ) : (
          <div className="create-wrap">
            <button className="primary-btn" onClick={() => setCreateOpen((open) => !open)}>
              <Plus size={16} /> 创建
            </button>
            {createOpen ? (
              <>
                <div className="menu-backdrop" onClick={() => setCreateOpen(false)} />
                <div className="floating-menu create-menu">
                  <button
                    onClick={() => {
                      setCreateOpen(false)
                      onPickImport()
                    }}
                  >
                    <Upload size={14} /> 上传文件
                  </button>
                  <button
                    onClick={() => {
                      setCreateOpen(false)
                      onNewFolder()
                    }}
                  >
                    <FolderPlus size={14} /> 新建文件夹
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </header>
  )
}
