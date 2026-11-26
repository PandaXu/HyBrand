const { app, BrowserWindow, Menu, protocol, shell, session, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const store = require('./store.cjs')

app.setName('HyBrand')

const dataDir = process.env.HYBRAND_DATA_DIR
  ? path.resolve(process.env.HYBRAND_DATA_DIR)
  : path.join(app.getPath('appData'), 'HyBrand')

fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(path.join(dataDir, 'session'), { recursive: true })
app.setPath('userData', dataDir)
app.setPath('sessionData', path.join(dataDir, 'session'))

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'hybrand',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])

let startupError = null
try {
  store.init(dataDir)
} catch (error) {
  startupError = error
}

let mainWindow = null

function sendMenuCommand(command) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('menu:command', command)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    title: 'HyBrand',
    backgroundColor: '#F5F6FB',
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 20 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.VITE_DEV_SERVER_URL
      ? url.startsWith(process.env.VITE_DEV_SERVER_URL)
      : url.startsWith('file://')
    if (!allowed) event.preventDefault()
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  return win
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const isDev = !app.isPackaged

  const template = [
    {
      label: 'HyBrand',
      submenu: [
        { role: 'about', label: '关于 HyBrand' },
        { type: 'separator' },
        {
          label: '设置…',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendMenuCommand('settings')
        },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 HyBrand' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: '退出 HyBrand' }
      ]
    },
    {
      label: '文件',
      submenu: [
        {
          label: '导入文件…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuCommand('import')
        },
        {
          label: '导入文件夹…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuCommand('import-folder')
        },
        {
          label: '新建文件夹',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => sendMenuCommand('new-folder')
        },
        { type: 'separator' },
        { role: 'close', label: '关闭窗口' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        ...(isDev
          ? [
              { role: 'reload', label: '重新载入' },
              { role: 'forceReload', label: '强制重新载入' },
              { role: 'toggleDevTools', label: '开发者工具' },
              { type: 'separator' }
            ]
          : []),
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front', label: '前置全部窗口' }] : [])
      ]
    },
    {
      role: 'help',
      label: '帮助',
      submenu: [
        {
          label: '打开数据目录',
          click: () => shell.openPath(store.getDataDir())
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function start() {
  const { registerIpc } = require('./ipc.cjs')
  const { registerMediaProtocol, clearAllTemps } = require('./media-protocol.cjs')
  const importer = require('./importer.cjs')

  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  registerMediaProtocol()
  registerIpc()
  buildMenu()

  app.setAboutPanelOptions({
    applicationName: 'HyBrand',
    applicationVersion: app.getVersion(),
    credits: '本地 AI 品牌资产工作台',
    copyright: '数据仅保存在本机'
  })

  mainWindow = createWindow()
  importer.recoverPending()

  app.on('activate', () => {
    if (!mainWindow) mainWindow = createWindow()
  })

  app.on('before-quit', () => {
    store.flush()
    clearAllTemps()
  })
}

if (startupError) {
  app.whenReady().then(() => {
    dialog.showErrorBox(
      '无法打开素材库',
      `${startupError.message}\n\n为避免覆盖数据，HyBrand 已退出。`
    )
    app.exit(1)
  })
} else {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
  } else {
    app.on('second-instance', () => {
      if (!mainWindow) {
        mainWindow = createWindow()
        return
      }
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    })

    app.whenReady().then(start)
  }

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
