import { _electron as electron } from 'playwright-core'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const electronPath = process.env.HYBRAND_EXECUTABLE || require('electron')
const appArgs = process.env.HYBRAND_EXECUTABLE ? [] : ['.']
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = path.join(root, 'test-artifacts')
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrand-smoke-'))
const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrand-fixtures-'))
fs.mkdirSync(artifacts, { recursive: true })

const errors = []
let app
let failed = false

async function waitFor(fn, timeout = 20000, interval = 300) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await fn()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error('等待条件超时')
}

async function snapshot(page) {
  return page.evaluate(() => window.hybrand.load())
}

async function waitForReadyCount(page, count, timeout = 120000) {
  return waitFor(async () => {
    const state = await snapshot(page)
    if (
      state.assets.length === count &&
      state.assets.every((asset) => asset.status !== 'processing')
    ) {
      return state
    }
    return null
  }, timeout, 400)
}

try {
  app = await electron.launch({
    executablePath: electronPath,
    args: appArgs,
    cwd: root,
    env: { ...process.env, HYBRAND_DATA_DIR: dataDir, NODE_ENV: 'production' }
  })
  const page = await app.firstWindow()
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

  await page.waitForSelector('.app, .boot-screen', { timeout: 15000 })
  await page.waitForSelector('.empty-state', { timeout: 15000 })
  await page.screenshot({ path: path.join(artifacts, '01-empty-state.png') })
  console.log('✓ 应用启动，空状态正常')

  const dataUrls = await page.evaluate(() => {
    const palettes = [
      ['#ff6b6b', '#ffd93d'],
      ['#4d96ff', '#6bcb77'],
      ['#845ec2', '#ffc75f']
    ]
    return palettes.map(([from, to], index) => {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const ctx = canvas.getContext('2d')
      const gradient = ctx.createLinearGradient(0, 0, 800, 600)
      gradient.addColorStop(0, from)
      gradient.addColorStop(1, to)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 800, 600)
      ctx.fillStyle = 'rgba(255,255,255,.85)'
      ctx.beginPath()
      ctx.arc(590, 180, 110, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1b1d26'
      ctx.font = '600 64px -apple-system, sans-serif'
      ctx.fillText(`HyBrand ${index + 1}`, 60, 510)
      return canvas.toDataURL('image/png')
    })
  })

  const fixturePaths = dataUrls.map((url, index) => {
    const file = path.join(fixtures, `hybrand-${index + 1}.png`)
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'))
    return file
  })

  const imported = await page.evaluate(
    (paths) => window.hybrand.importPaths(paths, null),
    fixturePaths
  )
  assert.equal(imported.added, 3, '应导入 3 个素材')
  console.log('✓ 导入 3 个素材')

  await page.waitForFunction(
    () => document.querySelectorAll('[data-asset-card="true"]').length >= 3,
    null,
    { timeout: 15000 }
  )

  const ready = await waitForReadyCount(page, 3, 60000)
  assert.ok(ready.assets.every((asset) => asset.featurePath), '每张素材都应生成视觉特征')
  assert.ok(ready.assets.some((asset) => asset.previewPath), '应生成系统缩略图')
  console.log('✓ 缩略图与本地 AI 特征处理完成')

  const previewLoaded = await page.evaluate(async () => {
    const state = await window.hybrand.load()
    const withPreview = state.assets.find((asset) => asset.previewPath)
    if (!withPreview) return false
    return new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve(image.naturalWidth > 0)
      image.onerror = () => resolve(false)
      image.src = `hybrand://preview/${withPreview.id}?v=${Date.now()}`
    })
  })
  assert.ok(previewLoaded, 'hybrand:// 预览协议应可加载')
  console.log('✓ hybrand:// 预览协议正常')

  const duplicate = await page.evaluate(
    (paths) => window.hybrand.importPaths(paths, null),
    fixturePaths
  )
  assert.equal(duplicate.added, 0, '重复导入应被去重')
  assert.equal(duplicate.duplicates, 3)
  console.log('✓ SHA-256 去重生效')

  await page.waitForFunction(
    () => {
      const images = [...document.querySelectorAll('.asset-card img')]
      return images.length >= 3 && images.every((image) => image.complete && image.naturalWidth > 0)
    },
    null,
    { timeout: 20000 }
  )
  await page.screenshot({ path: path.join(artifacts, '02-library.png') })

  await page.locator('.view-btn[title="自适应视图"]').click()
  await page.waitForTimeout(400)
  await page.waitForSelector('.adaptive-row')
  assert.equal(await page.locator('.adaptive-row .asset-card').count(), 3)
  await page.screenshot({ path: path.join(artifacts, '03-adaptive.png') })

  await page.locator('.view-btn[title="瀑布流视图"]').click()
  await page.waitForTimeout(300)
  await page.waitForSelector('.masonry-view')
  assert.equal(await page.locator('.masonry-view .asset-card').count(), 3)
  await page.screenshot({ path: path.join(artifacts, '04-masonry.png') })

  await page.locator('.view-btn[title="列表视图"]').click()
  await page.waitForTimeout(300)
  await page.waitForSelector('.list-row')
  assert.equal(await page.locator('.list-row').count(), 3)
  await page.screenshot({ path: path.join(artifacts, '05-list.png') })

  await page.locator('.view-btn[title="网格视图"]').click()
  await page.waitForSelector('.grid-view .asset-card')
  console.log('✓ 四种内容视图正常')

  await page.locator('.filter-pill', { hasText: '格式' }).click()
  await page.waitForSelector('.kind-popover')
  await page.screenshot({ path: path.join(artifacts, '06-filter-menu.png') })
  await page
    .locator('.kind-popover .option-row', { hasText: '视频' })
    .click()
  await page.keyboard.press('Escape')
  await page.waitForSelector('.empty-state')
  await page.screenshot({ path: path.join(artifacts, '07-filter-empty.png') })
  await page.locator('.empty-state').getByRole('button', { name: '清除筛选' }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('[data-asset-card="true"]').length === 3,
    null,
    { timeout: 5000 }
  )
  console.log('✓ 格式筛选与清除正常')

  await page.fill('.search-input', 'hybrand-2')
  await page.waitForFunction(
    () => document.querySelectorAll('[data-asset-card="true"]').length === 1,
    null,
    { timeout: 5000 }
  )
  await page.screenshot({ path: path.join(artifacts, '08-search.png') })
  await page.fill('.search-input', '')
  await page.waitForFunction(
    () => document.querySelectorAll('[data-asset-card="true"]').length === 3,
    null,
    { timeout: 5000 }
  )
  console.log('✓ 关键词搜索过滤正常')

  const firstCard = page.locator('[data-asset-card="true"]').first()
  await firstCard.hover()
  await firstCard.locator('button[title="收藏"]').click()
  await waitFor(async () => {
    const state = await snapshot(page)
    return state.assets.some((asset) => asset.favorite)
  })
  console.log('✓ 收藏操作正常')

  await firstCard.click()
  await page.waitForSelector('.details-panel')
  await page.locator('.tag-chips input').fill('测试标签')
  await page.locator('.tag-chips input').press('Enter')
  await waitFor(async () => {
    const state = await snapshot(page)
    return state.assets.some((asset) => asset.tags.includes('测试标签'))
  })
  console.log('✓ 详情面板与标签编辑正常')

  const folder = await page.evaluate(() => window.hybrand.createFolder('项目 A', null))
  await waitFor(async () => {
    const state = await snapshot(page)
    return state.folders.some((item) => item.id === folder.id)
  })
  await page.selectOption('.folder-select', folder.id)
  await waitFor(async () => {
    const state = await snapshot(page)
    return state.assets.some((asset) => asset.folderId === folder.id)
  })
  await page.screenshot({ path: path.join(artifacts, '09-details.png') })
  console.log('✓ 文件夹创建与素材移动正常')

  await page.locator('.folder-row', { hasText: '项目 A' }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('[data-asset-card="true"]').length === 1,
    null,
    { timeout: 5000 }
  )
  await page.screenshot({ path: path.join(artifacts, '10-folder.png') })
  await page.locator('.sidebar-nav').getByRole('button', { name: /全部素材/ }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('[data-asset-card="true"]').length === 3,
    null,
    { timeout: 5000 }
  )
  console.log('✓ 文件夹导航正常')

  const referenceId = (await snapshot(page)).assets.find((asset) => asset.featurePath).id
  const similar = await page.evaluate((id) => window.hybrand.similar(id), referenceId)
  assert.ok(similar.results.length >= 1, '相似检索应返回结果')

  await page.locator('[data-asset-card="true"]').first().click()
  await page.getByRole('button', { name: /查找相似素材/ }).click()
  await page.waitForSelector('.similar-header')
  await page.screenshot({ path: path.join(artifacts, '11-similar.png') })
  await page.getByRole('button', { name: /清空搜索/ }).click()
  await page.waitForSelector('.similar-header', { state: 'detached' })
  console.log('✓ 相似素材检索正常')

  await page.locator('[data-asset-card="true"]').first().click()
  await page.keyboard.press('Delete')
  await page.waitForFunction(
    () => document.querySelectorAll('[data-asset-card="true"]').length === 2,
    null,
    { timeout: 5000 }
  )
  const sidebar = page.locator('.sidebar')
  await sidebar.getByRole('button', { name: /回收站/ }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('[data-asset-card="true"]').length === 1,
    null,
    { timeout: 5000 }
  )
  await page.locator('[data-asset-card="true"]').first().click()
  await page.getByRole('button', { name: /恢复素材/ }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('[data-asset-card="true"]').length === 0,
    null,
    { timeout: 5000 }
  )
  await sidebar.getByRole('button', { name: /全部素材/ }).click()
  await page.waitForFunction(
    () => document.querySelectorAll('[data-asset-card="true"]').length === 3,
    null,
    { timeout: 5000 }
  )
  console.log('✓ 回收站与恢复正常')

  await page.waitForSelector('.toasts', { state: 'detached', timeout: 6000 }).catch(() => {})
  await page.locator('[data-asset-card="true"]').first().dblclick()
  await page.waitForSelector('.lightbox')
  await page.screenshot({ path: path.join(artifacts, '12-lightbox.png') })
  await page.keyboard.press('Escape')
  await page.waitForSelector('.lightbox', { state: 'detached' })
  console.log('✓ 全屏预览正常')

  const extraPaths = [
    '/System/Library/Desktop Pictures/Hello Metallic Blue.heic',
    '/System/Library/ProductDocuments/ProductGuides/ENERGY STAR.pdf',
    '/System/Library/CoreServices/NotificationCenter.app/Contents/Resources/mac_widgets-edu_small.mov'
  ].filter((file) => fs.existsSync(file))

  if (extraPaths.length) {
    const extra = await page.evaluate(
      (paths) => window.hybrand.importPaths(paths, null),
      extraPaths
    )
    assert.equal(extra.added, extraPaths.length)
    const all = await waitForReadyCount(page, 3 + extraPaths.length, 180000)
    const heic = all.assets.find((asset) => asset.ext === 'heic')
    const pdf = all.assets.find((asset) => asset.ext === 'pdf')
    const video = all.assets.find((asset) => asset.ext === 'mov')

    if (heic) {
      assert.ok(heic.previewPath, 'HEIC 应生成缩略图')
      assert.match(heic.previewPath, /\.jpg$/, 'HEIC 应使用 ImageIO 生成真实画面预览')
      assert.ok(heic.aiTags.length > 0, 'HEIC 应生成 AI 标签')
      assert.ok(heic.width > 0, 'HEIC 应读取尺寸')
      await page.waitForFunction(
        (name) => {
          const image = document.querySelector(`.asset-card[title="${name}"] img`)
          return Boolean(image && image.complete && image.naturalWidth > 0)
        },
        heic.name,
        { timeout: 10000 }
      )
    }
    if (pdf) {
      assert.ok(pdf.previewPath, 'PDF 应生成缩略图')
    }
    if (video) {
      assert.ok(video.previewPath, '视频应生成封面')
      assert.ok(video.duration > 0, '视频应读取时长')
    }
    console.log('✓ HEIC / PDF / 视频格式处理正常')

    if (heic) {
      await page.locator(`.asset-card[title="${heic.name}"]`).click()
      await page.waitForSelector('.details-panel')
      await page.evaluate(() => document.querySelector('.ai-tags')?.scrollIntoView({ block: 'center' }))
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(artifacts, '13-heic-details.png') })
      assert.ok((await page.locator('.ai-tag').count()) > 0, '详情面板应展示 AI 标签')
      console.log('✓ AI 标签在详情面板展示正常')
    }
  }

  await page.keyboard.press('Escape')
  await page.locator('.view-btn[title="瀑布流视图"]').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(artifacts, '16-masonry-mixed.png') })
  await page.locator('.view-btn[title="网格视图"]').click()
  await page.waitForSelector('.grid-view .asset-card')
  const cards = page.locator('.asset-card')
  await cards.nth(0).click()
  await cards.nth(2).click({ modifiers: ['Shift'] })
  await page.waitForSelector('.selection-bar')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(artifacts, '14-selection-bar.png') })
  await page.locator('.selection-actions').getByRole('button', { name: /标签/ }).click()
  await page.waitForSelector('.modal-card')
  await page.locator('.modal-input').fill('批量标签')
  await page.locator('.modal-actions').getByRole('button', { name: /添加标签/ }).click()
  await waitFor(async () => {
    const state = await snapshot(page)
    return state.assets.filter((asset) => asset.tags.includes('批量标签')).length >= 3
  })
  console.log('✓ 多选与批量打标正常')

  const dropUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 640
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createLinearGradient(0, 0, 640, 640)
    gradient.addColorStop(0, '#0ea5e9')
    gradient.addColorStop(1, '#22c55e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 640, 640)
    ctx.fillStyle = 'rgba(255,255,255,.9)'
    ctx.fillRect(120, 260, 400, 120)
    return canvas.toDataURL('image/png')
  })
  const dropPath = path.join(fixtures, 'hybrand-drop.png')
  fs.writeFileSync(dropPath, Buffer.from(dropUrl.split(',')[1], 'base64'))
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'smoke-drop-input'
    document.body.appendChild(input)
  })
  await page.setInputFiles('#smoke-drop-input', dropPath)
  const beforeDrop = (await snapshot(page)).assets.length
  await page.evaluate(() => {
    const input = document.querySelector('#smoke-drop-input')
    const transfer = new DataTransfer()
    transfer.items.add(input.files[0])
    document
      .querySelector('.content')
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }))
  })
  await waitForReadyCount(page, beforeDrop + 1, 60000)
  console.log('✓ 拖拽导入（webUtils 路径桥）正常')

  await page.keyboard.press('Escape')
  await page.locator('.sidebar-footer').getByTitle('设置').click()
  await page.waitForSelector('.modal-card')
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(artifacts, '15-settings.png') })
  await page.getByRole('button', { name: '完成' }).click()
  console.log('✓ 设置面板正常')

  // ---------- Brand space (Phase 1) ----------

  const fontCandidates = [
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc'
  ]
  const fontPath = fontCandidates.find((file) => fs.existsSync(file))
  if (fontPath) {
    const beforeFont = (await snapshot(page)).assets.length
    await page.evaluate((file) => window.hybrand.importPaths([file], null), fontPath)
    await waitForReadyCount(page, beforeFont + 1, 60000)
  }

  const brandSidebar = page.locator('.sidebar')
  await brandSidebar.getByRole('button', { name: /品牌手册/ }).click()
  await page.waitForSelector('.brand-page')
  await page.screenshot({ path: path.join(artifacts, '17-brand-empty.png') })

  await page.locator('.brand-top-actions').getByRole('button', { name: '编辑品牌' }).click()
  await page.waitForSelector('.modal-card')
  await page.fill('input[name="brand-name"]', '测试品牌')
  await page.fill('input[name="brand-tagline"]', '让品牌交付变得确定')
  await page.fill('[name="brand-description"]', '这是一个用于验证 HyBrand 品牌空间流程的本地品牌。')
  await page.fill('[name="brand-voice"]', '克制、清楚、不说空话。')
  await page.locator('.modal-card').getByRole('button', { name: '保存' }).click()
  await page.waitForSelector('.modal-card', { state: 'detached' })
  await page.waitForFunction(
    () => document.querySelector('.brand-hero h1')?.textContent.includes('测试品牌'),
    null,
    { timeout: 5000 }
  )

  await page.locator('.logo-card .card-head button[title="添加 Logo"]').click()
  await page.waitForSelector('.modal-card')
  await page.locator('.logo-pick', { hasText: 'hybrand-1.png' }).click()
  await page.fill('input[name="logo-label"]', '主 Logo')
  await page.fill('input[name="logo-min-width"]', '120px')
  await page.fill('input[name="logo-clear-space"]', 'Logo 高度的 50%')
  await page.getByRole('button', { name: '保存 Logo' }).click()
  await page.waitForSelector('.modal-card', { state: 'detached' })

  await page.locator('.colors-card .card-head button[title="添加品牌色"]').click()
  await page.waitForSelector('.modal-card')
  await page.fill('input[name="brand-color-name"]', '主色')
  await page.fill('input[name="color-hex"]', '#FF5C8A')
  await page.getByRole('button', { name: '保存品牌色' }).click()
  await page.waitForSelector('.modal-card', { state: 'detached' })

  if (fontPath) {
    await page.locator('.type-card .card-head button[title="添加字体"]').click()
    await page.waitForSelector('.modal-card')
    await page
      .locator('.typeface-option', { hasText: path.basename(fontPath) })
      .click()
    await page.fill('input[name="typeface-name"]', '品牌字体')
    await page.getByRole('button', { name: '保存字体' }).click()
    await page.waitForSelector('.modal-card', { state: 'detached' })
  }

  const brandSnapshot = await waitFor(async () => {
    const state = await snapshot(page)
    return state.brand.name === '测试品牌' &&
      state.brand.logoVariants.length &&
      state.brand.colors.length &&
      (!fontPath || state.brand.typography.length)
      ? state
      : null
  }, 15000)

  await page.waitForFunction(
    () => document.querySelector('.score-ring span')?.textContent !== '0%',
    null,
    { timeout: 5000 }
  )
  const score = Number(
    String(await page.locator('.score-ring span').innerText()).replace('%', '')
  )
  assert.ok(score > 0, '品牌完整度应随补齐规范提升')

  if (fontPath) {
    await page.waitForSelector('.typeface-sample')
    await page.waitForTimeout(900)
    const fontAsset = brandSnapshot.assets.find((asset) => asset.kind === 'font')
    assert.ok(fontAsset, '应导入字体素材')
    const fontLoaded = await page.evaluate(async (id) => {
      try {
        const faces = await document.fonts.load(`16px "BrandFont-${id}"`)
        return faces.length > 0
      } catch {
        return false
      }
    }, fontAsset.id)
    assert.ok(fontLoaded, '品牌字体应通过 hybrand:// 加载')
  }

  await page.waitForSelector('.toasts', { state: 'detached', timeout: 7000 }).catch(() => {})
  await page.evaluate(() => document.querySelector('.brand-scroll')?.scrollTo({ top: 0 }))
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(artifacts, '18-brand.png') })

  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrand-export-'))
  const exported = await page.evaluate(
    (destination) => window.hybrand.exportBrandKit(destination),
    exportDir
  )
  assert.ok(exported?.path, '品牌包应导出成功')
  assert.ok(fs.existsSync(path.join(exported.path, 'index.html')), '品牌包应包含 index.html')
  assert.ok(fs.existsSync(path.join(exported.path, 'brand.json')), '品牌包应包含 brand.json')
  assert.ok(fs.readdirSync(path.join(exported.path, 'logos')).length >= 1, '品牌包应包含 Logo 文件')
  if (fontPath) {
    assert.ok(fs.readdirSync(path.join(exported.path, 'fonts')).length >= 1, '品牌包应包含字体文件')
  }
  const exportedHtml = fs.readFileSync(path.join(exported.path, 'index.html'), 'utf8')
  assert.ok(exportedHtml.includes('测试品牌'), '品牌包 HTML 应包含品牌名称')
  assert.ok(exportedHtml.includes('#FF5C8A'), '品牌包 HTML 应包含品牌色')
  fs.rmSync(exportDir, { recursive: true, force: true })

  await brandSidebar.getByRole('button', { name: /全部素材/ }).click()
  await page.waitForSelector('.grid-view .asset-card')
  console.log('✓ 品牌空间、Logo/品牌色/字体、完整度与品牌包导出正常')

  assert.deepEqual(errors, [], `渲染进程不应有错误：\n${errors.join('\n')}`)
  console.log('\nHyBrand 冒烟测试全部通过')
} catch (error) {
  failed = true
  console.error('\nHyBrand 冒烟测试失败：', error)
  if (errors.length) console.error('渲染进程错误：\n' + errors.join('\n'))
  console.error('测试数据目录：', dataDir)
  process.exitCode = 1
} finally {
  if (app) {
    await app.evaluate(({ app }) => app.quit()).catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 200))
    await app.close().catch(() => {})
    try {
      app.process()?.kill('SIGTERM')
    } catch {
      // 进程已退出
    }
  }
  if (!failed) {
    fs.rmSync(dataDir, { recursive: true, force: true })
    fs.rmSync(fixtures, { recursive: true, force: true })
  }
}
