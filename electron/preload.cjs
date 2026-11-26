const { contextBridge, ipcRenderer, webUtils } = require('electron')

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload)

function subscribe(channel, callback) {
  const listener = (_event, data) => callback(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('hybrand', {
  load: () => invoke('library:load'),
  appInfo: () => invoke('app:info'),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  pickAndImport: (folderId) => invoke('import:pick', { folderId }),
  importPaths: (paths, folderId) => invoke('import:paths', { paths, folderId }),

  updateAsset: (id, patch) => invoke('asset:update', { id, patch }),
  batch: (ids, action, value) => invoke('assets:batch', { ids, action, value }),
  download: (id) => invoke('asset:download', { id }),
  reveal: (id) => invoke('asset:reveal', { id }),
  openExternal: (id) => invoke('asset:open', { id }),
  reanalyze: (id) => invoke('asset:reanalyze', { id }),

  createFolder: (name, parentId) => invoke('folder:create', { name, parentId }),
  renameFolder: (id, name) => invoke('folder:rename', { id, name }),
  deleteFolder: (id) => invoke('folder:delete', { id }),

  addComment: (assetId, text) => invoke('comments:add', { assetId, text }),
  deleteComment: (assetId, commentId) => invoke('comments:delete', { assetId, commentId }),

  similar: (id) => invoke('assets:similar', { id }),
  searchByImage: () => invoke('search:image'),
  clearSearchTemp: (token) => invoke('search:clear-temp', { token }),

  rebuildPreviews: () => invoke('maintenance:rebuild-previews'),
  rebuildAI: () => invoke('maintenance:rebuild-ai'),
  revealDataDir: () => invoke('system:reveal-data'),
  copyText: (text) => invoke('system:copy', { text }),

  updateBrandProfile: (patch) => invoke('brand:update-profile', patch),
  saveBrandLogo: (payload) => invoke('brand:save-logo', payload),
  removeBrandLogo: (id) => invoke('brand:remove-logo', { id }),
  saveBrandColor: (payload) => invoke('brand:save-color', payload),
  removeBrandColor: (id) => invoke('brand:remove-color', { id }),
  saveBrandTypeface: (payload) => invoke('brand:save-typeface', payload),
  removeBrandTypeface: (id) => invoke('brand:remove-typeface', { id }),
  exportBrandKit: (destination) => invoke('brand:export', { destination }),

  onLibraryChanged: (callback) => subscribe('library:changed', callback),
  onMenuCommand: (callback) => subscribe('menu:command', callback)
})
