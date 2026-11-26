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
  pickAndImportFolder: (folderId) => invoke('import:pick-folder', { folderId }),
  importPaths: (paths, folderId) => invoke('import:paths', { paths, folderId }),

  updateAsset: (id, patch) => invoke('asset:update', { id, patch }),
  unlinkAssetFolder: (id, folderId) => invoke('asset:unlink-folder', { id, folderId }),
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
  createSpace: (name) => invoke('space:create', { name }),
  switchSpace: (id) => invoke('space:switch', { id }),
  renameSpace: (id, name) => invoke('space:rename', { id, name }),
  deleteSpace: (id) => invoke('space:delete', { id }),
  copyText: (text) => invoke('system:copy', { text }),

  updateBrandProfile: (patch) => invoke('brand:update-profile', patch),
  saveBrandLogo: (payload) => invoke('brand:save-logo', payload),
  removeBrandLogo: (id) => invoke('brand:remove-logo', { id }),
  saveBrandColor: (payload) => invoke('brand:save-color', payload),
  removeBrandColor: (id) => invoke('brand:remove-color', { id }),
  saveBrandTypeface: (payload) => invoke('brand:save-typeface', payload),
  removeBrandTypeface: (id) => invoke('brand:remove-typeface', { id }),
  updateBrandTypeScale: (payload) => invoke('brand:update-typescale', payload),
  saveBrandPairing: (payload) => invoke('brand:save-pairing', payload),
  removeBrandPairing: (id) => invoke('brand:remove-pairing', { id }),

  createProduct: (payload) => invoke('product:create', payload),
  updateProduct: (id, patch) => invoke('product:update', { ...patch, id }),
  deleteProduct: (id) => invoke('product:delete', { id }),
  saveProductLogo: (payload) => invoke('product:save-logo', payload),
  removeProductLogo: (id) => invoke('product:remove-logo', { id }),
  saveProductColor: (payload) => invoke('product:save-color', payload),
  removeProductColor: (productId, colorId) =>
    invoke('product:remove-color', { productId, colorId }),
  updateProductTypefaces: (payload) => invoke('product:update-typefaces', payload),
  exportProductManual: (productId, destination) =>
    invoke('product:export', { productId, destination }),
  importProductManual: (sourceDir) => invoke('product:import', { sourceDir }),

  exportBrandKit: (destination) => invoke('brand:export', { destination }),
  importBrandKit: (sourceDir) => invoke('brand:import-kit', { sourceDir }),

  onLibraryChanged: (callback) => subscribe('library:changed', callback),
  onMenuCommand: (callback) => subscribe('menu:command', callback)
})
