const fs = require('node:fs')
const fsp = fs.promises
const path = require('node:path')
const store = require('./store.cjs')

const BROWSER_IMAGES = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp'])
const FONT_FORMATS = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' }

const LOGO_ROLE_LABELS = {
  primary: '主 Logo',
  reverse: '反白 Logo',
  monochrome: '单色 Logo',
  horizontal: '横版 Logo',
  vertical: '竖版 Logo',
  icon: '图标'
}

const TYPE_ROLE_LABELS = {
  brand: '品牌字体',
  heading: '标题字体',
  body: '正文字体'
}

const COLOR_CATEGORY_LABELS = {
  primary: '主色',
  secondary: '辅助色',
  accent: '强调色',
  neutral: '中性色',
  background: '背景色',
  text: '文字色'
}

function hexToRgb(hex) {
  const value = /^#[0-9a-f]{6}$/i.test(String(hex)) ? String(hex) : '#5B6CFF'
  return {
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16)
  }
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / d + 2)
    else h = 60 * ((rn - gn) / d + 4)
  }
  if (h < 0) h += 360
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function rgbToCmyk({ r, g, b }) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const k = 1 - Math.max(rn, gn, bn)
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
  return {
    c: Math.round(((1 - rn - k) / (1 - k)) * 100),
    m: Math.round(((1 - gn - k) / (1 - k)) * 100),
    y: Math.round(((1 - bn - k) / (1 - k)) * 100),
    k: Math.round(k * 100)
  }
}

function colorValues(hex) {
  const rgb = hexToRgb(hex)
  const hsl = rgbToHsl(rgb)
  const cmyk = rgbToCmyk(rgb)
  return {
    hex: String(hex).toUpperCase(),
    rgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    hsl: `${hsl.h}°, ${hsl.s}%, ${hsl.l}%`,
    cmyk: `${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%`
  }
}

function linearChannel(value) {
  const channel = value / 255
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const rgb = hexToRgb(hex)
  return 0.2126 * linearChannel(rgb.r) + 0.7152 * linearChannel(rgb.g) + 0.0722 * linearChannel(rgb.b)
}

function contrastInfo(hex) {
  const color = luminance(hex)
  const white = Math.round(((1.05 / (color + 0.05))) * 100) / 100
  const black = Math.round(((color + 0.05) / 0.05) * 100) / 100
  return {
    white,
    black,
    whiteAA: white >= 4.5,
    whiteAAA: white >= 7,
    blackAA: black >= 4.5,
    blackAAA: black >= 7
  }
}

function cssFamily(entry) {
  return entry ? `'${entry.family}', sans-serif` : '-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif'
}

function buildTypeScale(brand, fontEntries) {
  const byId = new Map(fontEntries.map((entry) => [entry.id, entry]))
  const base = Number(brand.typeScale?.base) || 16
  const ratio = Number(brand.typeScale?.ratio) || 1.25
  const steps = brand.typeScale?.steps || {}

  return [
    { key: 'display', label: 'Display', power: 4, lineHeight: 1.1, sample: brand.name || '品牌标题' },
    { key: 'h1', label: 'H1', power: 3, lineHeight: 1.2, sample: '一级标题' },
    { key: 'h2', label: 'H2', power: 2, lineHeight: 1.3, sample: '二级标题' },
    { key: 'h3', label: 'H3', power: 1, lineHeight: 1.4, sample: '三级标题' },
    { key: 'body', label: 'Body', power: 0, lineHeight: 1.6, sample: '正文示例：让品牌交付变得确定。' },
    { key: 'caption', label: 'Caption', power: -1, lineHeight: 1.4, sample: '注释与辅助信息' }
  ].map((step) => {
    const entry = byId.get(steps[step.key]?.typefaceId) || null
    return {
      ...step,
      size: Math.round(base * ratio ** step.power * 10) / 10,
      weight: entry?.weight || 400,
      family: cssFamily(entry),
      fontName: entry ? `${entry.brandFamily || entry.displayName} ${entry.weight || 400}` : '系统字体'
    }
  })
}

function buildPairings(brand, fontEntries) {
  const byId = new Map(fontEntries.map((entry) => [entry.id, entry]))
  return (brand.pairings || [])
    .map((pairing) => ({
      ...pairing,
      heading: byId.get(pairing.headingTypefaceId) || null,
      body: byId.get(pairing.bodyTypefaceId) || null
    }))
    .filter((pairing) => pairing.heading || pairing.body)
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitize(value, fallback = 'file') {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')
    .slice(0, 60)
  return cleaned || fallback
}

function stamp() {
  const date = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours()
  )}${pad(date.getMinutes())}`
}

async function exists(filePath) {
  try {
    const stat = await fsp.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
}

async function nextFolder(parent, baseName) {
  let candidate = path.join(parent, baseName)
  let index = 2
  while (fs.existsSync(candidate)) {
    candidate = path.join(parent, `${baseName}-${index}`)
    index += 1
  }
  return candidate
}

function logoSource(asset) {
  const ext = String(asset.ext || '').toLowerCase()
  if (BROWSER_IMAGES.has(ext)) return store.originalPath(asset)
  return store.previewFilePath(asset) || null
}

function renderHtml({ brand, logoEntries, fontEntries, exportedAt }) {
  const primaryHex = brand.colors[0]?.hex || '#5B6CFF'
  const primaryLogo = logoEntries.find((entry) => entry.role === 'primary') || logoEntries[0]
  const fontFaces = fontEntries
    .map(
      (entry) =>
        `@font-face{font-family:'${entry.family}';src:url('${entry.file}') format('${entry.format}');font-weight:${entry.weight || 400};font-display:swap;}`
    )
    .join('\n')
  const scaleSteps = buildTypeScale(brand, fontEntries)
  const pairings = buildPairings(brand, fontEntries)

  const logoSection = logoEntries.length
    ? logoEntries
        .map(
          (entry) => `
        <article class="logo-card">
          <div class="logo-preview"><img src="${escapeHtml(entry.file)}" alt="${escapeHtml(
            entry.displayName
          )}" /></div>
          <div class="logo-meta">
            <div class="role">${escapeHtml(LOGO_ROLE_LABELS[entry.role] || entry.role)}</div>
            <h3>${escapeHtml(entry.displayName)}</h3>
            ${
              entry.minWidth || entry.clearSpace
                ? `<dl class="rules">
                    ${entry.minWidth ? `<div><dt>最小宽度</dt><dd>${escapeHtml(entry.minWidth)}</dd></div>` : ''}
                    ${entry.clearSpace ? `<div><dt>安全边距</dt><dd>${escapeHtml(entry.clearSpace)}</dd></div>` : ''}
                  </dl>`
                : ''
            }
            ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
            <a class="download" href="${escapeHtml(entry.file)}" download>下载素材</a>
          </div>
        </article>`
        )
        .join('')
    : '<p class="empty">还没有 Logo 变体。</p>'

  const colorSection = brand.colors.length
    ? brand.colors
        .map((color) => {
          const values = colorValues(color.hex)
          const contrast = contrastInfo(color.hex)
          return `
        <article class="color-card">
          <div class="swatch" style="background:${escapeHtml(values.hex)}"></div>
          <div class="role">${escapeHtml(COLOR_CATEGORY_LABELS[color.category] || '主色')}</div>
          <h3>${escapeHtml(color.name)}</h3>
          ${color.usage ? `<p class="usage">${escapeHtml(color.usage)}</p>` : ''}
          <dl>
            <div><dt>HEX</dt><dd>${escapeHtml(values.hex)}</dd></div>
            <div><dt>RGB</dt><dd>${escapeHtml(values.rgb)}</dd></div>
            <div><dt>HSL</dt><dd>${escapeHtml(values.hsl)}</dd></div>
            <div><dt>CMYK</dt><dd>${escapeHtml(values.cmyk)}</dd></div>
            ${color.pantone ? `<div><dt>Pantone</dt><dd>${escapeHtml(color.pantone)}</dd></div>` : ''}
          </dl>
          <div class="contrast">白底 ${contrast.white}:1 ${contrast.whiteAAA ? 'AAA' : contrast.whiteAA ? 'AA' : '—'} · 黑底 ${contrast.black}:1 ${contrast.blackAAA ? 'AAA' : contrast.blackAA ? 'AA' : '—'}</div>
        </article>`
        })
        .join('')
    : '<p class="empty">还没有定义品牌色。</p>'

  const familyGroups = new Map()
  for (const entry of fontEntries) {
    const name = entry.brandFamily || entry.displayName || '品牌字体'
    if (!familyGroups.has(name)) familyGroups.set(name, [])
    familyGroups.get(name).push(entry)
  }
  const typeSection = fontEntries.length
    ? [...familyGroups.entries()]
        .map(
          ([familyName, variants]) => `
        <article class="font-family">
          <div class="font-family-head"><h3>${escapeHtml(familyName)}</h3><span>${variants.length} 个样式</span></div>
          ${variants
            .map(
              (entry) => `
          <div class="font-variant">
            <div class="type-sample" style="font-family:'${entry.family}', sans-serif;font-weight:${entry.weight || 400}">${escapeHtml(
              entry.sample
            )}</div>
            <div class="type-meta">
              <div class="role">${escapeHtml(TYPE_ROLE_LABELS[entry.role] || entry.role)} · ${entry.weight || 400}</div>
              <h3>${escapeHtml(entry.displayName)}</h3>
              ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ''}
              <a class="download" href="${escapeHtml(entry.file)}" download>下载字体</a>
            </div>
          </div>`
            )
            .join('')}
        </article>`
        )
        .join('')
    : '<p class="empty">还没有添加品牌字体。</p>'

  const scaleSection = `
  <section class="section"><h2>字阶</h2>
    <div class="scale">
      ${scaleSteps
        .map(
          (step) => `
        <div class="scale-row">
          <div class="scale-meta"><span>${escapeHtml(step.label)}</span><small>${step.size}px / ${step.lineHeight}</small><em>${escapeHtml(step.fontName)}</em></div>
          <div class="scale-sample" style="font-family:${step.family};font-weight:${step.weight};font-size:${step.size}px;line-height:${step.lineHeight}">${escapeHtml(step.sample)}</div>
        </div>`
        )
        .join('')}
    </div>
  </section>`

  const pairingSection = `
  <section class="section"><h2>字体搭配</h2>
    <div class="pairing-list">
      ${
        pairings.length
          ? pairings
              .map(
                (pairing) => `
        <div class="pairing">
          <div class="pairing-name">${escapeHtml(pairing.name)}</div>
          <div class="pairing-heading" style="font-family:${pairing.heading ? `'${pairing.heading.family}', sans-serif` : '-apple-system,sans-serif'};font-weight:${pairing.heading?.weight || 400}">${escapeHtml(
            brand.name || '品牌标题'
          )}</div>
          <p class="pairing-body" style="font-family:${pairing.body ? `'${pairing.body.family}', sans-serif` : '-apple-system,sans-serif'};font-weight:${pairing.body?.weight || 400}">让品牌交付变得确定。标题、正文和注释各有清晰层级，团队可以直接照着使用。</p>
          ${pairing.note ? `<p class="pairing-note">${escapeHtml(pairing.note)}</p>` : ''}
          <small>标题：${escapeHtml(pairing.heading?.brandFamily || pairing.heading?.displayName || '未指定')} · 正文：${escapeHtml(
            pairing.body?.brandFamily || pairing.body?.displayName || '未指定'
          )}</small>
        </div>`
              )
              .join('')
          : '<p class="empty">还没有字体搭配。</p>'
      }
    </div>
  </section>`

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(brand.name || '品牌手册')}</title>
<style>
${fontFaces}
:root{--brand:${escapeHtml(primaryHex)};--ink:#14161c;--muted:#6b7280;--line:#e9ebf2;--bg:#f5f6fb;--card:#fff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",Arial,sans-serif;line-height:1.6}
a{color:var(--brand)}
.wrap{max-width:1080px;margin:0 auto;padding:48px 28px 80px}
header{display:flex;align-items:center;gap:20px;padding:28px;background:var(--card);border:1px solid var(--line);border-radius:20px;box-shadow:0 10px 30px rgba(20,22,28,.06)}
.brand-logo{width:92px;height:92px;border-radius:16px;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 92px}
.brand-logo img{width:100%;height:100%;object-fit:contain}
.brand-logo span{font-size:36px;font-weight:700;color:var(--brand)}
header h1{margin:0;font-size:34px;letter-spacing:-.5px}
header .tagline{margin:4px 0 0;color:var(--muted);font-size:15px}
header .description{margin:10px 0 0;color:var(--muted);font-size:13px;max-width:640px}
.section{margin-top:36px}
.section>h2{font-size:18px;margin:0 0 14px;display:flex;align-items:center;gap:8px}
.section>h2:before{content:"";width:6px;height:18px;border-radius:3px;background:var(--brand)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.logo-card,.color-card,.type-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;box-shadow:0 2px 8px rgba(20,22,28,.03)}
.logo-preview{height:150px;border-radius:10px;background:repeating-conic-gradient(#f5f6fb 0 25%,#fff 0 50%) 0 0/18px 18px;display:flex;align-items:center;justify-content:center;padding:18px}
.logo-preview img{max-width:100%;max-height:100%;object-fit:contain}
.logo-meta h3,.color-card h3,.type-meta h3{margin:10px 0 4px;font-size:14px}
.role{font-size:11px;color:var(--brand);font-weight:600}
.logo-meta p,.type-meta p{margin:6px 0;color:var(--muted);font-size:12px}
.rules{margin:8px 0;display:flex;gap:18px;font-size:11px;color:var(--muted)}
.rules dt{font-weight:600;color:var(--ink)}
.rules dd{margin:2px 0 0}
.download{display:inline-block;margin-top:8px;font-size:12px;text-decoration:none;border:1px solid var(--line);border-radius:7px;padding:4px 9px;color:var(--brand)}
.swatch{height:86px;border-radius:10px;margin-bottom:10px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
.color-card dl{margin:8px 0 0;font-size:11px;color:var(--muted)}
.color-card dl div{display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-top:1px dashed #f0f1f6}
.color-card dt{color:#9ca3af}
.color-card dd{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink)}
.color-card .usage{margin:4px 0 0;color:var(--muted);font-size:11px;line-height:1.5}
.color-card .contrast{margin-top:8px;color:#9ca3af;font-size:10px}
.scale{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:8px 18px;box-shadow:0 2px 8px rgba(20,22,28,.03)}
.scale-row{display:flex;align-items:baseline;gap:18px;padding:10px 0;border-top:1px solid #f0f1f6}
.scale-row:first-child{border-top:none}
.scale-meta{width:82px;flex:0 0 82px;display:flex;flex-direction:column;gap:2px}
.scale-meta span{font-size:11px;font-weight:600;color:var(--ink)}
.scale-meta small{font-size:9.5px;color:#9ca3af}
.scale-meta em{display:block;font-style:normal;font-size:9px;color:#9ca3af;margin-top:2px}
.scale-sample{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pairing-list{display:flex;flex-direction:column;gap:16px}
.pairing{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;box-shadow:0 2px 8px rgba(20,22,28,.03)}
.pairing-name{font-size:12px;font-weight:600;color:#6b7280;margin-bottom:10px}
.pairing-heading{font-size:30px;line-height:1.2;margin-bottom:10px}
.pairing-body{margin:0;font-size:14px;line-height:1.65;color:var(--muted)}
.pairing-note{margin:12px 0 6px;padding-top:10px;border-top:1px dashed #e4e7f0;color:#9ca3af;font-size:11px;line-height:1.6;white-space:pre-wrap}
.pairing small{color:#9ca3af;font-size:10px}

.type-sample{font-size:34px;line-height:1.25;padding:18px;background:var(--bg);border-radius:10px;word-break:break-word}
.type-sample .small{display:block;font-size:16px;margin-top:8px;color:var(--muted)}
.voice{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;white-space:pre-wrap;color:var(--ink);font-size:13px}
.empty{color:var(--muted);font-size:13px;margin:0}
footer{margin-top:48px;color:#9ca3af;font-size:11px;border-top:1px solid var(--line);padding-top:16px}
@media(max-width:720px){.wrap{padding:24px 16px 48px}header{align-items:flex-start;flex-direction:column}.font-variant{grid-template-columns:1fr}.type-sample{font-size:26px}}
@media print{body{background:#fff}.wrap{padding:0}header,.logo-card,.color-card,.font-family,.scale,.pairing,.voice{box-shadow:none;break-inside:avoid}.download{display:none}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand-logo">${
      primaryLogo
        ? `<img src="${escapeHtml(primaryLogo.file)}" alt="${escapeHtml(primaryLogo.displayName)}" />`
        : `<span>${escapeHtml((brand.name || 'H').slice(0, 1).toUpperCase())}</span>`
    }</div>
    <div>
      <h1>${escapeHtml(brand.name || '未命名品牌')}</h1>
      ${brand.tagline ? `<p class="tagline">${escapeHtml(brand.tagline)}</p>` : ''}
      ${brand.description ? `<p class="description">${escapeHtml(brand.description)}</p>` : ''}
    </div>
  </header>

  <section class="section"><h2>Logo</h2><div class="grid">${logoSection}</div></section>
  <section class="section"><h2>品牌色</h2><div class="grid">${colorSection}</div></section>
  <section class="section"><h2>字体</h2><div class="font-family-list">${typeSection}</div></section>
${scaleSection}
${pairingSection}
  ${
    brand.voice
      ? `<section class="section"><h2>品牌语气与使用原则</h2><div class="voice">${escapeHtml(
          brand.voice
        )}</div></section>`
      : ''
  }

  <footer>
    ${escapeHtml(brand.name || '品牌手册')} · 由 HyBrand 生成 · ${escapeHtml(exportedAt)}
  </footer>
</div>
</body>
</html>`
}

async function exportBrandKit({ destination }) {
  const state = store.getState()
  const brand = store.getBrand()
  const timestamp = stamp()
  const folder = await nextFolder(
    destination,
    `${sanitize(brand.name || 'brand', 'brand')}-brand-kit-${timestamp}`
  )
  const logoDir = path.join(folder, 'logos')
  const fontDir = path.join(folder, 'fonts')
  await fsp.mkdir(logoDir, { recursive: true })
  await fsp.mkdir(fontDir, { recursive: true })

  const warnings = []
  const logoEntries = []

  for (const variant of brand.logoVariants) {
    const asset = state.assets.find(
      (item) => item.id === variant.assetId && item.spaceId === state.activeSpaceId && !item.trashed
    )
    if (!asset) {
      warnings.push(`Logo「${variant.label || variant.role}」引用的素材已不存在`)
      continue
    }
    const source = logoSource(asset)
    if (!source || !(await exists(source))) {
      warnings.push(`Logo「${variant.label || asset.name}」没有可导出的预览文件`)
      continue
    }
    const ext = path.extname(source).toLowerCase()
    const fileName = `${logoEntries.length + 1}-${sanitize(variant.role, 'logo')}-${sanitize(
      asset.name.replace(/\.[^.]+$/, ''),
      'logo'
    )}${ext}`
    await fsp.copyFile(source, path.join(logoDir, fileName))
    logoEntries.push({
      ...variant,
      displayName: variant.label || asset.name,
      file: `logos/${fileName}`
    })
  }

  const fontEntries = []
  for (const typeface of brand.typography) {
    const asset = state.assets.find(
      (item) => item.id === typeface.assetId && item.spaceId === state.activeSpaceId && !item.trashed
    )
    if (!asset) {
      warnings.push(`字体「${typeface.name || typeface.role}」引用的素材已不存在`)
      continue
    }
    const source = store.originalPath(asset)
    if (!(await exists(source))) {
      warnings.push(`字体「${typeface.name || asset.name}」文件不存在`)
      continue
    }
    const ext = path.extname(source).slice(1).toLowerCase()
    const fileName = `${fontEntries.length + 1}-${sanitize(
      typeface.name || asset.name.replace(/\.[^.]+$/, ''),
      'font'
    )}${path.extname(source)}`
    await fsp.copyFile(source, path.join(fontDir, fileName))
    const family = `HyBrandFont${fontEntries.length + 1}`
    fontEntries.push({
      ...typeface,
      brandFamily: typeface.family || typeface.name || '品牌字体',
      displayName: typeface.name || asset.name.replace(/\.[^.]+$/, ''),
      file: `fonts/${fileName}`,
      family,
      format: FONT_FORMATS[ext] || 'truetype',
      sample: typeface.sample || `${brand.name || '品牌'} Aa 0123`
    })
  }

  const exportedAt = new Date().toLocaleString('zh-CN')
  const html = renderHtml({ brand, logoEntries, fontEntries, exportedAt })
  await fsp.writeFile(path.join(folder, 'index.html'), html, 'utf8')

  const manifest = {
    manifestVersion: 2,
    exportedAt: new Date().toISOString(),
    app: 'HyBrand',
    brand: {
      name: brand.name,
      tagline: brand.tagline,
      description: brand.description,
      voice: brand.voice,
      colors: brand.colors,
      typeScale: brand.typeScale,
      pairings: (brand.pairings || []).map((pairing) => ({
        name: pairing.name,
        headingTypefaceId: pairing.headingTypefaceId,
        bodyTypefaceId: pairing.bodyTypefaceId,
        note: pairing.note
      })),
      logoVariants: logoEntries.map((entry) => ({
        role: entry.role,
        label: entry.displayName,
        minWidth: entry.minWidth,
        clearSpace: entry.clearSpace,
        note: entry.note,
        file: entry.file
      })),
      typography: fontEntries.map((entry) => ({
        id: entry.id,
        role: entry.role,
        family: entry.brandFamily,
        name: entry.displayName,
        note: entry.note,
        sample: entry.sample,
        weight: entry.weight || 400,
        file: entry.file
      }))
    },
    warnings
  }
  await fsp.writeFile(path.join(folder, 'brand.json'), JSON.stringify(manifest, null, 2), 'utf8')
  await fsp.writeFile(
    path.join(folder, 'README.txt'),
    `HyBrand 品牌包\n\n打开 index.html 查看品牌手册。\n- logos/ 下为 Logo 文件\n- fonts/ 下为字体文件\n- brand.json 为结构化品牌数据\n\n生成时间：${exportedAt}\n`,
    'utf8'
  )

  return {
    path: folder,
    logos: logoEntries.length,
    fonts: fontEntries.length,
    colors: brand.colors.length,
    warnings
  }
}

module.exports = {
  exportBrandKit,
  colorValues,
  escapeHtml,
  sanitize,
  stamp,
  nextFolder,
  exists
}
