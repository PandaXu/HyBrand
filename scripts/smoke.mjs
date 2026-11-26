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

  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'smoke-dup-input'
    document.body.appendChild(input)
  })
  await page.setInputFiles('#smoke-dup-input', fixturePaths[0])
  await page.evaluate(() => {
    const input = document.querySelector('#smoke-dup-input')
    const transfer = new DataTransfer()
    transfer.items.add(input.files[0])
    document
      .querySelector('.content')
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }))
  })
  await page.getByRole('button', { name: '查看已有' }).click()
  await page.waitForSelector('.modal-card')
  assert.ok((await page.locator('.duplicate-row').count()) >= 1, '重复文件应提供快捷链接')
  const existingLink = page.locator('.duplicate-file-link').first()
  await existingLink.waitFor()
  assert.ok((await existingLink.innerText()).trim().length > 0, '已有文件应显示可点击链接')
  await page
    .locator('.duplicate-file-actions')
    .first()
    .getByRole('button', { name: '在 Finder 中显示' })
    .waitFor()
  await page.getByRole('button', { name: '知道了' }).click()
  await page.waitForSelector('.modal-card', { state: 'detached' })
  console.log('✓ 重复文件提供已有文件快捷链接')

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

  const fontDefs = [
    {
      path: '/System/Library/Fonts/Supplemental/Arial.ttf',
      file: 'Arial.ttf',
      family: '品牌无衬线',
      name: 'Regular',
      role: 'body',
      weight: 400
    },
    {
      path: '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
      file: 'Arial Bold.ttf',
      family: '品牌无衬线',
      name: 'Bold',
      role: 'heading',
      weight: 700
    },
    {
      path: '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
      file: 'Times New Roman.ttf',
      family: '品牌衬线',
      name: 'Serif',
      role: 'brand',
      weight: 400
    }
  ].filter((font) => fs.existsSync(font.path))
  if (fontDefs.length) {
    const beforeFonts = (await snapshot(page)).assets.length
    await page.evaluate(
      (paths) => window.hybrand.importPaths(paths, null),
      fontDefs.map((font) => font.path)
    )
    await waitForReadyCount(page, beforeFonts + fontDefs.length, 60000)
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
  assert.ok((await page.locator('.palette-pick').count()) > 0, '颜色弹窗应从素材色板取色')
  assert.ok((await page.locator('.contrast-line').count()) > 0, '颜色弹窗应显示对比度')
  await page.fill('input[name="brand-color-name"]', '主色')
  await page.selectOption('select[name="color-category"]', 'secondary')
  await page.fill('input[name="color-usage"]', '辅助按钮与标签')
  await page.fill('input[name="color-hex"]', '#FF5C8A')
  await page.getByRole('button', { name: '保存品牌色' }).click()
  await page.waitForSelector('.modal-card', { state: 'detached' })

  for (const font of fontDefs) {
    await page.locator('.type-card .card-head button[title="添加字体"]').click()
    await page.waitForSelector('.modal-card')
    await page.locator('.typeface-option', { hasText: font.file }).click()
    await page.fill('input[name="typeface-family"]', font.family)
    await page.fill('input[name="typeface-name"]', font.name)
    await page.selectOption('select[name="typeface-role"]', font.role)
    await page.selectOption('select[name="typeface-weight"]', String(font.weight))
    await page.getByRole('button', { name: '保存字体' }).click()
    await page.waitForSelector('.modal-card', { state: 'detached' })
  }

  const brandSnapshot = await waitFor(async () => {
    const state = await snapshot(page)
    return state.brand.name === '测试品牌' &&
      state.brand.logoVariants.length &&
      state.brand.colors.length &&
      (!fontDefs.length || state.brand.typography.length === fontDefs.length)
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

  if (fontDefs.length) {
    await page.waitForSelector('.font-family-card')
    await page.waitForTimeout(300)
    const regular = brandSnapshot.brand.typography.find((item) => item.name === 'Regular')
    const bold = brandSnapshot.brand.typography.find((item) => item.name === 'Bold')
    const serif = brandSnapshot.brand.typography.find((item) => item.name === 'Serif')
    assert.ok(regular && bold && serif, '应建立三个字体样式')
    assert.ok((await page.locator('.font-family-card').count()) >= 2, '字体应按家族分组')
    assert.equal(await page.locator('.typeface-row').count(), fontDefs.length)

    await page.getByRole('button', { name: '编辑字阶' }).click()
    await page.waitForSelector('.modal-card')
    assert.equal(await page.locator('.scale-step-row').count(), 6)
    await page.fill('input[name="type-scale-base"]', '16')
    await page.fill('input[name="type-scale-ratio"]', '1.25')
    for (const key of ['display', 'h1', 'h2', 'h3']) {
      await page.selectOption(`select[name="scale-step-${key}"]`, bold.id)
    }
    for (const key of ['body', 'caption']) {
      await page.selectOption(`select[name="scale-step-${key}"]`, regular.id)
    }
    await page.getByRole('button', { name: '保存字体系统' }).click()
    await page.waitForSelector('.modal-card', { state: 'detached' })
    await waitFor(async () => {
      const state = await snapshot(page)
      return (
        state.brand.typeScale?.steps?.display?.typefaceId === bold.id &&
        state.brand.typeScale?.steps?.body?.typefaceId === regular.id
      )
    }, 10000)
    assert.equal(await page.locator('.scale-row').count(), 6)

    async function addPairing(name, headingId, bodyId, note) {
      await page
        .locator('.type-subhead', { hasText: '字体搭配' })
        .getByRole('button', { name: '添加搭配' })
        .click()
      await page.waitForSelector('.modal-card')
      await page.fill('input[name="pairing-name"]', name)
      await page.selectOption('select[name="pairing-heading"]', headingId)
      await page.selectOption('select[name="pairing-body"]', bodyId)
      await page.fill('[name="pairing-note"]', note)
      await page.getByRole('button', { name: '保存搭配' }).click()
      await page.waitForSelector('.modal-card', { state: 'detached' })
    }

    await addPairing('官网主搭配', bold.id, regular.id, '标题使用品牌标题字，正文使用品牌正文字体。')
    await addPairing('编辑风格', serif.id, regular.id, '活动页可以使用衬线标题与无衬线正文。')
    await waitFor(async () => (await snapshot(page)).brand.pairings.length === 2, 10000)
    await page.waitForFunction(
      () => document.querySelectorAll('.pairing-card').length === 2,
      null,
      { timeout: 5000 }
    )

    await page.waitForSelector('.toasts', { state: 'detached', timeout: 7000 }).catch(() => {})
    await page.locator('.type-card').scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(artifacts, '19-typography.png') })
  }

  if (fontDefs.length) {
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
  if (fontDefs.length) {
    assert.ok(fs.readdirSync(path.join(exported.path, 'fonts')).length >= 1, '品牌包应包含字体文件')
  }
  const exportedHtml = fs.readFileSync(path.join(exported.path, 'index.html'), 'utf8')
  assert.ok(exportedHtml.includes('测试品牌'), '品牌包 HTML 应包含品牌名称')
  assert.ok(exportedHtml.includes('#FF5C8A'), '品牌包 HTML 应包含品牌色')
  assert.ok(exportedHtml.includes('辅助按钮与标签'), '品牌包 HTML 应包含颜色用途')
  assert.ok(exportedHtml.includes('字阶'), '品牌包 HTML 应包含字阶')
  assert.ok(exportedHtml.includes('字体搭配'), '品牌包 HTML 应包含字体搭配')
  assert.ok(exportedHtml.includes('品牌无衬线'), '品牌包 HTML 应包含字体家族')
  assert.ok(exportedHtml.includes('品牌衬线'), '品牌包 HTML 应包含第二个字体家族')
  assert.ok(exportedHtml.includes('标题使用品牌标题字'), '品牌包 HTML 应包含搭配说明')
  assert.ok(exportedHtml.includes('活动页可以使用衬线标题'), '品牌包 HTML 应包含第二组搭配')
  fs.rmSync(exportDir, { recursive: true, force: true })

  await brandSidebar.getByRole('button', { name: /全部素材/ }).click()
  await page.waitForSelector('.grid-view .asset-card')
  console.log('✓ 品牌空间、Logo/品牌色/字体、完整度与品牌包导出正常')

  await page.locator('.create-wrap .primary-btn').click()
  await page.waitForSelector('.create-menu')
  await page.locator('.create-menu').getByRole('button', { name: /上传文件夹/ }).waitFor()
  await page.mouse.click(8, 8)
  await page.waitForSelector('.create-menu', { state: 'detached' })

  const folderRoot = path.join(fixtures, '项目素材')
  fs.mkdirSync(path.join(folderRoot, 'Logo'), { recursive: true })
  fs.writeFileSync(path.join(folderRoot, '说明.txt'), '项目素材说明')
  fs.writeFileSync(path.join(folderRoot, 'Logo', '品牌 Logo 说明.txt'), 'Logo 文件说明')
  const beforeFolder = (await snapshot(page)).assets.length
  const folderImport = await page.evaluate(
    (folder) => window.hybrand.importPaths([folder], null),
    folderRoot
  )
  assert.equal(folderImport.added, 2, '文件夹内文件应全部导入')
  assert.equal(folderImport.foldersCreated, 2, '应创建根文件夹和子文件夹')
  const folderState = await waitForReadyCount(page, beforeFolder + 2, 60000)
  const folderRootRecord = folderState.folders.find((folder) => folder.name === '项目素材')
  const logoFolder = folderState.folders.find(
    (folder) => folder.name === 'Logo' && folder.parentId === folderRootRecord?.id
  )
  assert.ok(folderRootRecord && logoFolder, '应保留本地目录结构')
  const noteAsset = folderState.assets.find((asset) => asset.name === '说明.txt')
  const logoNoteAsset = folderState.assets.find((asset) => asset.name === '品牌 Logo 说明.txt')
  assert.equal(noteAsset?.folderId, folderRootRecord.id)
  assert.equal(logoNoteAsset?.folderId, logoFolder.id)
  await page.locator('.folder-card', { hasText: '项目素材' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(artifacts, '20-folder-import.png') })
  await brandSidebar.getByRole('button', { name: /全部素材/ }).click()
  console.log('✓ 文件夹上传与目录结构保留正常')

  await page.locator('.folder-row', { hasText: '项目素材' }).click()
  await page.waitForSelector('.grid-view .asset-card')
  const shortcutBefore = await snapshot(page)
  const shortcutFile = fixturePaths.find((file) => {
    const asset = shortcutBefore.assets.find((item) => item.name === path.basename(file))
    return asset && !asset.trashed && asset.folderId !== folderRootRecord.id
  })
  assert.ok(shortcutFile, '应有一个不在目标文件夹内的重复文件用于创建快捷链接')
  const shortcutAsset = shortcutBefore.assets.find(
    (item) => item.name === path.basename(shortcutFile)
  )

  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'smoke-shortcut-input'
    document.body.appendChild(input)
  })
  await page.setInputFiles('#smoke-shortcut-input', shortcutFile)
  await page.evaluate(() => {
    const input = document.querySelector('#smoke-shortcut-input')
    const transfer = new DataTransfer()
    transfer.items.add(input.files[0])
    document
      .querySelector('.content')
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }))
  })
  await waitFor(async () => {
    const state = await snapshot(page)
    const asset = state.assets.find((item) => item.id === shortcutAsset.id)
    return asset?.linkedFolderIds?.includes(folderRootRecord.id)
  }, 10000)
  const shortcutAfter = await snapshot(page)
  assert.equal(shortcutAfter.stats.total, shortcutBefore.stats.total, '快捷链接不应新增素材或占用存储')
  await page.waitForSelector('.shortcut-badge')
  await page.screenshot({ path: path.join(artifacts, '22-folder-shortcut.png') })
  console.log('✓ 重复文件在当前文件夹显示快捷链接')

  const linkedCard = page
    .locator('.asset-card')
    .filter({ has: page.locator('.shortcut-badge') })
    .first()
  await linkedCard.hover()
  await linkedCard.locator('button[title="更多"]').click()
  await page.getByRole('button', { name: '移除快捷链接' }).click()
  await waitFor(async () => {
    const state = await snapshot(page)
    const asset = state.assets.find((item) => item.id === shortcutAsset.id)
    return asset && !asset.linkedFolderIds.includes(folderRootRecord.id)
  })
  await page.waitForFunction(() => !document.querySelector('.shortcut-badge'))
  assert.ok(
    (await snapshot(page)).assets.some((item) => item.id === shortcutAsset.id),
    '移除快捷链接不应删除源素材'
  )
  await brandSidebar.getByRole('button', { name: /全部素材/ }).click()
  console.log('✓ 快捷链接可单独移除，源素材保留')

  const firstSpaceState = await snapshot(page)
  assert.equal(firstSpaceState.spaces.length, 1, '初始应只有一个品牌空间')
  const firstSpaceId = firstSpaceState.activeSpaceId
  const firstSpaceName = firstSpaceState.spaces[0].name
  const firstBrandName = firstSpaceState.brand.name
  const firstAssetTotal = firstSpaceState.stats.total

  await page.locator('.space-switcher').click()
  await page.waitForSelector('.space-menu')
  await page.screenshot({ path: path.join(artifacts, '21-space-menu.png') })
  await page.locator('.space-menu').getByRole('button', { name: /新建品牌空间/ }).click()
  await page.waitForSelector('.modal-card')
  await page.fill('input[name="space-name"]', '第二品牌')
  await page.getByRole('button', { name: '创建空间' }).click()
  await page.waitForSelector('.modal-card', { state: 'detached' })
  const secondSpaceState = await waitFor(async () => {
    const state = await snapshot(page)
    return state.activeSpaceId !== firstSpaceId ? state : null
  }, 10000)
  assert.equal(secondSpaceState.spaces.length, 2)
  assert.equal(secondSpaceState.stats.total, 0, '新空间应为空')
  assert.equal(secondSpaceState.brand.name, '第二品牌')
  const secondSpaceId = secondSpaceState.activeSpaceId
  assert.equal(
    secondSpaceState.spaces.find((space) => space.id === secondSpaceId).assetCount,
    0
  )

  const secondFile = path.join(fixtures, '第二空间素材.txt')
  fs.writeFileSync(secondFile, '第二个品牌空间的素材')
  const secondImport = await page.evaluate(
    (file) => window.hybrand.importPaths([file], null),
    secondFile
  )
  assert.equal(secondImport.added, 1)
  await waitForReadyCount(page, 1, 60000)
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(artifacts, '22-second-space.png') })

  await page.locator('.space-switcher').click()
  await page.waitForSelector('.space-menu')
  await page.locator('.space-menu .space-option', { hasText: firstSpaceName }).click()
  const backState = await waitFor(async () => {
    const state = await snapshot(page)
    return state.activeSpaceId === firstSpaceId ? state : null
  }, 10000)
  await page.waitForFunction(
    (name) => document.querySelector('.space-switcher-copy strong')?.textContent === name,
    firstSpaceName,
    { timeout: 5000 }
  )
  assert.equal(backState.brand.name, firstBrandName)
  assert.equal(backState.stats.total, firstAssetTotal, '切回后原空间数据应完整')
  assert.equal(
    backState.spaces.find((space) => space.id === secondSpaceId).assetCount,
    1,
    '第二个空间应保留自己的素材'
  )

  await page.locator('.space-switcher').click()
  await page.waitForSelector('.space-menu')
  await page.locator('.space-menu .space-option', { hasText: '第二品牌' }).click()
  await waitFor(async () => (await snapshot(page)).activeSpaceId === secondSpaceId, 10000)
  await page.waitForFunction(
    () => document.querySelector('.space-switcher-copy strong')?.textContent === '第二品牌',
    null,
    { timeout: 5000 }
  )
  await page.locator('.sidebar-footer').getByTitle('设置').click()
  await page.waitForSelector('.modal-card')
  await page.fill('input[name="space-name-input"]', '第二品牌改')
  await page.getByRole('button', { name: '保存名称' }).click()
  await waitFor(async () => {
    const state = await snapshot(page)
    return state.spaces.find((space) => space.id === secondSpaceId)?.name === '第二品牌改'
  }, 10000)
  await page.getByRole('button', { name: '删除当前品牌空间' }).click()
  await page.waitForSelector('.modal-card')
  await page.getByRole('button', { name: '删除空间' }).click()
  await waitFor(async () => {
    const state = await snapshot(page)
    return state.spaces.length === 1 && state.activeSpaceId === firstSpaceId
  }, 10000)
  const finalSpaceState = await snapshot(page)
  assert.equal(finalSpaceState.spaces.length, 1)
  assert.equal(finalSpaceState.brand.name, firstBrandName)
  assert.equal(finalSpaceState.stats.total, firstAssetTotal, '删除空间不应影响原空间')
  console.log('✓ 多品牌空间创建、切换、数据隔离、重命名与删除正常')

  const kitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrand-kit-'))
  const kit = await page.evaluate(
    (destination) => window.hybrand.exportBrandKit(destination),
    kitDir
  )
  assert.ok(kit?.path, '应能导出用于导入测试的品牌包')
  const importedKit = await page.evaluate(
    (directory) => window.hybrand.importBrandKit(directory),
    kit.path
  )
  assert.ok(importedKit?.spaceId, '品牌包应导入为新空间')
  const kitState = await waitFor(async () => {
    const state = await snapshot(page)
    return state.activeSpaceId === importedKit.spaceId ? state : null
  }, 15000)
  assert.equal(kitState.spaces.length, 2)
  assert.equal(kitState.brand.name, firstBrandName)
  assert.equal(kitState.brand.colors[0]?.hex, '#FF5C8A')
  assert.ok(kitState.brand.logoVariants.length >= 1)
  assert.ok(kitState.brand.typography.length >= 3)
  assert.equal(kitState.brand.pairings.length, 2)
  const importedBold = kitState.brand.typography.find((item) => item.name === 'Bold')
  assert.ok(importedBold, '导入后应保留 Bold 字体样式')
  assert.equal(kitState.brand.typeScale.steps.display.typefaceId, importedBold.id)
  await page.evaluate((id) => window.hybrand.deleteSpace(id), importedKit.spaceId)
  await waitFor(async () => (await snapshot(page)).activeSpaceId === firstSpaceId, 10000)
  fs.rmSync(kitDir, { recursive: true, force: true })
  console.log('✓ 品牌包导入为新空间、规范与字体映射正常')

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
    const child = app.process()
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close().catch(() => {})
    try {
      if (child && child.exitCode === null) child.kill('SIGKILL')
    } catch {
      // 进程已退出
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  if (!failed) {
    fs.rmSync(dataDir, { recursive: true, force: true })
    fs.rmSync(fixtures, { recursive: true, force: true })
  }
}
