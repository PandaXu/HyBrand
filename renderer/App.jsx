import { useEffect, useMemo, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import api from './api.js'
import { useApp } from './store.js'
import { callApi, toast } from './actions.js'
import { deriveView, descendantFolderIds, folderPath, hasActiveFilters } from './utils.js'
import { hasFiles, hasInternalAssets, readAssetIds, readFilePaths } from './drop.js'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import FilterBar from './components/FilterBar.jsx'
import FolderCards from './components/FolderCards.jsx'
import AssetViews from './components/AssetViews.jsx'
import DetailsPanel from './components/DetailsPanel.jsx'
import BrandSpace from './components/BrandSpace.jsx'
import ProductsPage from './components/ProductsPage.jsx'
import ProductSpace from './components/ProductSpace.jsx'
import ProductDialogs from './components/ProductDialogs.jsx'
import BrandDialogs from './components/BrandDialogs.jsx'
import Dialogs from './components/Dialogs.jsx'
import {
  Lightbox,
  SelectionBar,
  Toasts,
  EmptyState,
  SimilarHeader,
  DragOverlay
} from './components/Overlays.jsx'

function summarizeImport(result) {
  if (!result) return
  const parts = []
  if (result.added) parts.push(`已导入 ${result.added} 个素材`)
  if (result.foldersCreated) parts.push(`新建 ${result.foldersCreated} 个文件夹`)
  if (result.duplicates) {
    parts.push(
      result.linked
        ? `检测到 ${result.duplicates} 个重复文件，已在当前目录创建 ${result.linked} 个快捷链接`
        : `跳过 ${result.duplicates} 个重复文件`
    )
  }
  if (result.errors) parts.push(`${result.errors} 个导入失败`)
  if (!parts.length) parts.push('没有可导入的文件')
  const succeeded = result.added > 0 || result.foldersCreated > 0 || result.linked > 0
  const state = useApp.getState()
  const action =
    result.duplicates > 0 && result.duplicateItems?.length
      ? {
          label: '查看已有',
          onClick: () =>
            state.openDialog({ type: 'duplicates', items: result.duplicateItems })
        }
      : null
  state.toast(parts.join('，'), succeeded ? 'success' : result.errors ? 'error' : 'info', action)
}

export default function App() {
  const app = useApp()
  const {
    library,
    ready,
    nav,
    search,
    filters,
    sort,
    viewMode,
    thumbSize,
    selection,
    activeId,
    lightboxId,
    similar,
    dragging
  } = app

  const view = useMemo(
    () => deriveView({ library, nav, search, filters, similar, sort }),
    [library, nav, search, filters, similar, sort]
  )

  const linkedIds = useMemo(() => {
    if (nav.type !== 'folder') return new Set()
    return new Set(
      view.assets
        .filter(
          (asset) =>
            asset.folderId !== nav.id && (asset.linkedFolderIds || []).includes(nav.id)
        )
        .map((asset) => asset.id)
    )
  }, [view.assets, nav])

  const activeAsset = activeId ? library.assets.find((asset) => asset.id === activeId) : null
  const lightboxAsset = lightboxId
    ? library.assets.find((asset) => asset.id === lightboxId)
    : null
  const referenceAsset = similar?.referenceId
    ? library.assets.find((asset) => asset.id === similar.referenceId)
    : null

  const searchRef = useRef(null)
  const contentRef = useRef(null)
  const visibleRef = useRef(view.assets)
  const handlersRef = useRef({})
  visibleRef.current = view.assets

  async function pickImport() {
    const state = useApp.getState()
    const folderId = state.nav.type === 'folder' ? state.nav.id : null
    const result = await callApi(api.pickAndImport(folderId), '导入失败')
    if (!result) return
    if (state.nav.type === 'trash' || state.similar) state.setNav({ type: 'all' })
    summarizeImport(result)
  }

  async function pickFolder() {
    const state = useApp.getState()
    const folderId = state.nav.type === 'folder' ? state.nav.id : null
    const result = await callApi(api.pickAndImportFolder(folderId), '上传文件夹失败')
    if (!result) return
    if (state.nav.type === 'trash' || state.similar || state.nav.type === 'brand') {
      state.setNav({ type: 'all' })
    }
    summarizeImport(result)
  }

  async function importPathsTo(paths, folderId) {
    if (!paths.length) return
    const result = await callApi(api.importPaths(paths, folderId ?? null), '导入失败')
    if (result) summarizeImport(result)
  }

  function openNewFolder(parentId) {
    useApp.getState().openDialog({ type: 'folder', mode: 'create', parentId: parentId ?? null })
  }

  function openNewFolderInCurrent() {
    const state = useApp.getState()
    openNewFolder(state.nav.type === 'folder' ? state.nav.id : null)
  }

  function trashAssets(ids) {
    if (!ids.length) return
    callApi(api.batch(ids, 'trash'), '移入回收站失败').then((result) => {
      if (!result) return
      const state = useApp.getState()
      state.clearSelection()
      if (state.lightboxId) state.closeLightbox()
      state.toast(`已将 ${result.count} 个素材移入回收站`)
    })
  }

  function restoreAssets(ids) {
    if (!ids.length) return
    callApi(api.batch(ids, 'restore'), '恢复失败').then((result) => {
      if (!result) return
      const state = useApp.getState()
      state.clearSelection()
      state.toast(`已恢复 ${result.count} 个素材`, 'success')
    })
  }

  function requestDeleteForever(ids, options = {}) {
    if (!ids.length) return
    useApp.getState().openDialog({
      type: 'confirm',
      title: options.title || '彻底删除',
      message:
        options.message ||
        `将永久删除 ${ids.length} 个素材及其文件，此操作不可撤销。`,
      confirmLabel: options.confirmLabel || '彻底删除',
      danger: true,
      onConfirm: async () => {
        const result = await callApi(api.batch(ids, 'deleteForever'), '删除失败')
        if (!result) return
        const state = useApp.getState()
        state.clearSelection()
        if (state.lightboxId) state.closeLightbox()
        state.toast(`已永久删除 ${result.count} 个素材`, 'success')
      }
    })
  }

  function requestEmptyTrash() {
    const ids = library.assets.filter((asset) => asset.trashed).map((asset) => asset.id)
    requestDeleteForever(ids, {
      title: '清空回收站',
      message: `确定清空回收站吗？将永久删除 ${ids.length} 个素材及其文件，此操作不可撤销。`,
      confirmLabel: '清空回收站'
    })
  }

  function favoriteAssets(ids) {
    if (!ids.length) return
    callApi(api.batch(ids, 'favorite'), '收藏失败').then((result) => {
      if (result) toast(`已收藏 ${result.count} 个素材`, 'success')
    })
  }

  async function toggleFavorite(asset) {
    await callApi(api.updateAsset(asset.id, { favorite: !asset.favorite }), '更新收藏失败')
  }

  async function findSimilar(asset) {
    if (!asset.featurePath) {
      toast('素材还在 AI 解析中，请稍后再试')
      return
    }
    const state = useApp.getState()
    toast('正在查找相似素材…')
    const result = await callApi(api.similar(asset.id), '查找相似素材失败')
    if (!result) return
    const scopeFolderId = state.nav.type === 'folder' ? state.nav.id : null
    useApp.getState().setSimilar({
      referenceId: asset.id,
      name: asset.name,
      results: result.results,
      scopeFolderId
    })
    if (!result.results.length) toast('没有找到相似素材')
  }

  async function searchByImage() {
    const state = useApp.getState()
    toast('正在分析图片…')
    const result = await callApi(api.searchByImage(), '以图搜图失败')
    if (!result) return
    useApp.getState().setSimilar({
      token: result.token,
      name: result.name,
      results: result.results,
      scopeFolderId: state.nav.type === 'folder' ? state.nav.id : null
    })
    if (!result.results.length) toast('没有找到相似素材')
  }

  async function downloadAsset(asset) {
    const saved = await callApi(api.download(asset.id), '下载失败')
    if (saved) toast('素材已保存', 'success')
  }

  function revealAsset(asset) {
    callApi(api.reveal(asset.id), '无法在 Finder 中显示')
  }

  async function openAsset(asset) {
    const result = await callApi(api.openExternal(asset.id), '无法打开素材')
    if (result?.error) toast('没有可用的默认应用打开该文件', 'error')
  }

  async function unlinkAsset(asset) {
    const nav = useApp.getState().nav
    if (nav.type !== 'folder') return
    const result = await callApi(api.unlinkAssetFolder(asset.id, nav.id), '移除快捷链接失败')
    if (result) toast('已移除快捷链接', 'success')
  }

  function requestDeleteFolder(folder) {
    const count = view.countsByFolder.get(folder.id) || 0
    const state = useApp.getState()
    state.openDialog({
      type: 'confirm',
      title: '删除文件夹',
      message: `确定删除「${folder.name}」吗？其中 ${count} 个素材将移入回收站。`,
      confirmLabel: '删除文件夹',
      danger: true,
      onConfirm: async () => {
        const result = await callApi(api.deleteFolder(folder.id), '删除文件夹失败')
        if (!result) return
        const current = useApp.getState()
        if (current.nav.type === 'folder') {
          const folderIds = descendantFolderIds(current.library.folders, folder.id)
          if (folderIds.has(current.nav.id)) current.setNav({ type: 'all' })
        }
        current.toast(`文件夹已删除，${result.trashed} 个素材移入回收站`, 'success')
      }
    })
  }

  function handleSelect(id, event) {
    const state = useApp.getState()
    state.select(id, {
      meta: event?.metaKey || event?.ctrlKey || false,
      shift: event?.shiftKey || false,
      visibleIds: visibleRef.current.map((asset) => asset.id)
    })
  }

  handlersRef.current = {
    pickImport,
    pickFolder,
    importPathsTo,
    openNewFolder,
    openNewFolderInCurrent,
    trashAssets,
    restoreAssets,
    requestDeleteForever,
    requestEmptyTrash,
    favoriteAssets,
    findSimilar,
    searchByImage,
    requestDeleteFolder
  }

  useEffect(() => {
    let cancelled = false
    if (!api) {
      toast('请通过 HyBrand 桌面应用打开', 'error')
      return undefined
    }
    api
      .load()
      .then((snapshot) => {
        if (!cancelled) useApp.getState().setLibrary(snapshot)
      })
      .catch((error) => toast(error?.message || '加载素材库失败', 'error'))
    const unsubscribe = api.onLibraryChanged((snapshot) => {
      useApp.getState().setLibrary(snapshot)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (nav.type !== 'folder') return
    const path = folderPath(library.folders, nav.id)
    for (const folder of path.slice(0, -1)) useApp.getState().expandFolder(folder.id)
  }, [nav, library.folders])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [nav.type, nav.id, similar])

  useEffect(() => {
    const unsubscribe = api.onMenuCommand((command) => {
      const state = useApp.getState()
      if (command === 'import') handlersRef.current.pickImport()
      else if (command === 'import-folder') handlersRef.current.pickFolder()
      else if (command === 'new-folder') handlersRef.current.openNewFolderInCurrent()
      else if (command === 'settings') state.openDialog({ type: 'settings' })
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      const state = useApp.getState()
      const target = event.target
      const typing =
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (['brand', 'products', 'product'].includes(state.nav.type)) {
          state.setNav({ type: 'all' })
          setTimeout(() => {
            searchRef.current?.focus()
            searchRef.current?.select()
          }, 40)
          return
        }
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }

      if (event.key === 'Escape') {
        if (state.lightboxId) {
          state.closeLightbox()
          return
        }
        if (state.dialog) {
          state.closeDialog()
          return
        }
        if (state.selection.length) {
          state.clearSelection()
          return
        }
        if (state.search) {
          state.setSearch('')
          return
        }
        if (state.similar) state.clearSimilar()
        return
      }

      if (typing) return
      if (['brand', 'products', 'product'].includes(state.nav.type)) return

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        state.selectAll(visibleRef.current.map((asset) => asset.id))
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && state.selection.length) {
        event.preventDefault()
        if (state.nav.type === 'trash') handlersRef.current.requestDeleteForever(state.selection)
        else handlersRef.current.trashAssets(state.selection)
        return
      }

      if (event.key === ' ' && state.activeId) {
        event.preventDefault()
        state.openLightbox(state.activeId)
        return
      }

      if (event.key === 'Enter' && state.activeId) {
        event.preventDefault()
        state.openLightbox(state.activeId)
        return
      }

      if (
        (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
        !state.lightboxId &&
        state.selection.length === 1
      ) {
        const visible = visibleRef.current
        const index = visible.findIndex((asset) => asset.id === state.activeId)
        const next = visible[index + (event.key === 'ArrowRight' ? 1 : -1)]
        if (next) {
          event.preventDefault()
          state.select(next.id, { visibleIds: visible.map((asset) => asset.id) })
          requestAnimationFrame(() => {
            document
              .querySelector('[data-active="true"]')
              ?.scrollIntoView({ block: 'nearest' })
          })
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function handleDragEnter(event) {
    if (hasFiles(event.dataTransfer)) {
      event.preventDefault()
      useApp.getState().setDragging(true)
    }
  }

  function handleDragOver(event) {
    if (hasFiles(event.dataTransfer) || hasInternalAssets(event.dataTransfer)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = hasFiles(event.dataTransfer) ? 'copy' : 'move'
    }
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      useApp.getState().setDragging(false)
    }
  }

  async function handleDrop(event) {
    event.preventDefault()
    useApp.getState().setDragging(false)
    const assetIds = readAssetIds(event.dataTransfer)
    if (assetIds.length) {
      const state = useApp.getState()
      if (state.nav.type === 'folder') {
        const result = await callApi(api.batch(assetIds, 'move', state.nav.id), '移动失败')
        if (result) toast(`已移动 ${result.count} 个素材`, 'success')
      }
      return
    }
    const paths = readFilePaths(event.dataTransfer)
    if (!paths.length) return
    const state = useApp.getState()
    await importPathsTo(paths, state.nav.type === 'folder' ? state.nav.id : null)
  }

  const filtersActive = hasActiveFilters(filters)
  const showDetails =
    selection.length === 1 &&
    activeAsset &&
    !lightboxId &&
    !['brand', 'products', 'product'].includes(nav.type)

  if (!ready) {
    return (
      <div className="boot-screen">
        <div className="brand-mark large">H</div>
        <div className="boot-title">HyBrand</div>
        <Loader2 size={18} className="spin" />
      </div>
    )
  }

  return (
    <div
      className="app"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Sidebar
        library={library}
        nav={nav}
        counts={view.counts}
        countsByFolder={view.countsByFolder}
        manualTags={view.manualTags}
        filters={filters}
        onNavigate={(nextNav) => useApp.getState().setNav(nextNav)}
        onToggleTag={(tag) => useApp.getState().toggleTag(tag)}
        onNewFolder={(parentId) => openNewFolder(parentId)}
        onRenameFolder={(folder) =>
          useApp.getState().openDialog({ type: 'folder', mode: 'rename', folder })
        }
        onDeleteFolder={requestDeleteFolder}
        onMoveAssets={(ids, folderId) => {
          callApi(api.batch(ids, 'move', folderId), '移动失败').then((result) => {
            if (result) toast(`已移动 ${result.count} 个素材`, 'success')
          })
        }}
        onImportToFolder={(paths, folderId) => importPathsTo(paths, folderId)}
        onOpenSettings={() => useApp.getState().openDialog({ type: 'settings' })}
      />

      <div className="workspace">
        {nav.type === 'brand' ? (
          <BrandSpace />
        ) : nav.type === 'products' ? (
          <ProductsPage />
        ) : nav.type === 'product' ? (
          <ProductSpace productId={nav.productId} />
        ) : (
          <>
        <TopBar
          library={library}
          nav={nav}
          similar={similar}
          search={search}
          searchRef={searchRef}
          visibleCount={view.assets.length}
          onSearch={(value) => useApp.getState().setSearch(value)}
          onNavigate={(nextNav) => useApp.getState().setNav(nextNav)}
          onPickImport={pickImport}
          onPickFolder={pickFolder}
          onNewFolder={openNewFolderInCurrent}
          onSearchByImage={searchByImage}
          onEmptyTrash={requestEmptyTrash}
        />

        <FilterBar
          filters={filters}
          tagOptions={view.tagOptions}
          kindCounts={view.kindCounts}
          colorCounts={view.colorCounts}
          sort={sort}
          viewMode={viewMode}
          thumbSize={thumbSize}
          onSort={(value) => useApp.getState().setSort(value)}
          onViewMode={(value) => useApp.getState().setViewMode(value)}
          onThumbSize={(value) => useApp.getState().setThumbSize(Number(value))}
          actions={{
            toggleKind: (value) => useApp.getState().toggleKind(value),
            toggleColor: (value) => useApp.getState().toggleColor(value),
            toggleTag: (value) => useApp.getState().toggleTag(value),
            setTagMode: (value) => useApp.getState().setTagMode(value),
            setShape: (value) => useApp.getState().setShape(value),
            setDate: (value) => useApp.getState().setDate(value),
            toggleFavorite: () => useApp.getState().toggleFavoriteFilter(),
            clear: () => useApp.getState().clearFilters()
          }}
        />

        {similar ? (
          <SimilarHeader
            similar={similar}
            referenceAsset={referenceAsset}
            count={view.assets.length}
            onClear={() => useApp.getState().clearSimilar()}
          />
        ) : null}

        <div className="content" ref={contentRef}>
          {view.childFolders.length > 0 ? (
            <FolderCards
              folders={view.childFolders}
              countsByFolder={view.countsByFolder}
              onOpen={(folder) => useApp.getState().setNav({ type: 'folder', id: folder.id })}
            />
          ) : null}

          {view.assets.length > 0 ? (
            <AssetViews
              assets={view.assets}
              viewMode={viewMode}
              thumbSize={thumbSize}
              selection={selection}
              activeId={activeId}
              onSelect={handleSelect}
              onCheck={(id) => useApp.getState().toggleChecked(id)}
              onOpen={(id) => useApp.getState().openLightbox(id)}
              onFavorite={toggleFavorite}
              onSimilar={findSimilar}
              onDownload={downloadAsset}
              onReveal={revealAsset}
              onOpenExternal={openAsset}
              onTrash={(asset) => trashAssets([asset.id])}
              onRestore={(asset) => restoreAssets([asset.id])}
              onUnlink={unlinkAsset}
              isTrash={nav.type === 'trash'}
              linkedIds={linkedIds}
            />
          ) : (
            <EmptyState
              nav={nav}
              search={search}
              filtersActive={filtersActive}
              similar={Boolean(similar)}
              onPickImport={pickImport}
              onPickFolder={pickFolder}
              onNewFolder={openNewFolderInCurrent}
              onClearFilters={() => useApp.getState().clearFilters()}
              onClearSearch={() => useApp.getState().setSearch('')}
              onClearSimilar={() => useApp.getState().clearSimilar()}
            />
          )}
        </div>
          </>
        )}
      </div>

      {showDetails ? (
        <DetailsPanel
          key={activeAsset.id}
          asset={activeAsset}
          folders={library.folders}
          allTags={view.manualTags}
          onClose={() => useApp.getState().clearSelection()}
          onLightbox={() => useApp.getState().openLightbox(activeAsset.id)}
          onFavorite={toggleFavorite}
          onDownload={downloadAsset}
          onReveal={revealAsset}
          onOpenExternal={openAsset}
          onSimilar={findSimilar}
          onTrash={() => trashAssets([activeAsset.id])}
          onRestore={() => restoreAssets([activeAsset.id])}
          isTrash={nav.type === 'trash'}
        />
      ) : null}

      {selection.length > 1 && !['brand', 'products', 'product'].includes(nav.type) ? (
        <SelectionBar
          count={selection.length}
          isTrash={nav.type === 'trash'}
          onFavorite={() => favoriteAssets(selection)}
          onMove={() => useApp.getState().openDialog({ type: 'move', ids: selection })}
          onTag={() => useApp.getState().openDialog({ type: 'batch-tag', ids: selection })}
          onTrash={() => trashAssets(selection)}
          onRestore={() => restoreAssets(selection)}
          onDeleteForever={() => requestDeleteForever(selection)}
          onClear={() => useApp.getState().clearSelection()}
        />
      ) : null}

      {lightboxAsset && !['brand', 'products', 'product'].includes(nav.type) ? (
        <Lightbox
          asset={lightboxAsset}
          assets={view.assets}
          onNavigate={(id) => useApp.getState().openLightbox(id)}
          onClose={() => useApp.getState().closeLightbox()}
          onFavorite={toggleFavorite}
          onDownload={downloadAsset}
          onOpenExternal={openAsset}
          onReveal={revealAsset}
          onTrash={() => trashAssets([lightboxAsset.id])}
          onRestore={() => restoreAssets([lightboxAsset.id])}
          isTrash={nav.type === 'trash'}
        />
      ) : null}

      <Dialogs />
      <BrandDialogs />
      <ProductDialogs />
      <Toasts />
      {dragging ? <DragOverlay /> : null}
    </div>
  )
}
