const fs = require('node:fs')
const fsp = fs.promises
const path = require('node:path')
const store = require('./store.cjs')
const {
  colorValues,
  escapeHtml,
  sanitize,
  stamp,
  nextFolder,
  exists
} = require('./brand-export.cjs')

const BROWSER_IMAGES = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp'])
const PRODUCT_STATUS_LABELS = {
  concept: '概念',
  upcoming: '待上市',
  active: '在售',
  archived: '已归档'
}
const COLOR_CATEGORY_LABELS = {
  primary: '主色',
  secondary: '辅助色',
  accent: '强调色',
  neutral: '中性色',
  background: '背景色',
  text: '文字色'
}

function productAssets(product) {
  const state = store.getState()
  if (!product.folderId) return []
  const scope = store.folderDescendants(product.folderId)
  return state.assets
    .filter(
      (asset) =>
        asset.spaceId === state.activeSpaceId &&
        !asset.trashed &&
        ((asset.folderId && scope.has(asset.folderId)) ||
          (asset.linkedFolderIds || []).some((id) => scope.has(id)))
    )
    .sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt)))
}

function typefaceDescriptor(brand, typefaceId) {
  if (!typefaceId) return null
  const entry = (brand.typography || []).find((item) => item.id === typefaceId)
  if (!entry) return null
  return {
    family: entry.family || entry.name || '品牌字体',
    name: entry.name || entry.family || '字体',
    weight: entry.weight || 400
  }
}

function assetHtml(entry) {
  const src = entry.preview || (entry.webImage ? entry.file : null)
  if (src) {
    return `<figure class="asset"><img src="${escapeHtml(src)}" alt="${escapeHtml(
      entry.name
    )}" loading="lazy"><figcaption>${escapeHtml(entry.name)}</figcaption></figure>`
  }
  return `<figure class="asset file"><div class="file-tile">${escapeHtml(
    String(entry.ext || 'FILE').toUpperCase()
  )}</div><figcaption>${escapeHtml(entry.name)}</figcaption></figure>`
}

function renderHtml({ brand, product, logoEntry, assetEntries, heading, body, exportedAt }) {
  const primaryHex = product.colors[0]?.hex || '#5B6CFF'
  const logoSource = logoEntry
    ? logoEntry.preview || (logoEntry.webImage ? logoEntry.file : null)
    : null
  const colors = product.colors
    .map((color) => {
      const values = colorValues(color.hex)
      return `
      <article class="color">
        <span class="swatch" style="background:${escapeHtml(color.hex)}"></span>
        <div>
          <div class="color-name"><em>${escapeHtml(color.name || '产品色')}</em><span>${escapeHtml(
            COLOR_CATEGORY_LABELS[color.category] || color.category || ''
          )}</span></div>
          <code>${escapeHtml(values.hex)}</code>
          <small>RGB ${escapeHtml(values.rgb)} · HSL ${escapeHtml(values.hsl)} · CMYK ${escapeHtml(
            values.cmyk
          )}</small>
          ${color.pantone ? `<small>Pantone ${escapeHtml(color.pantone)}</small>` : ''}
          ${color.usage ? `<p>${escapeHtml(color.usage)}</p>` : ''}
        </div>
      </article>`
    })
    .join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(product.name)} · 产品手册</title>
<style>
:root{--text:#1b1d26;--text-2:#4f5566;--text-3:#8b8d98;--accent:${escapeHtml(
    primaryHex
  )};--border:#e8eaf1;--bg:#f5f6fb;--panel:#fff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1080px;margin:0 auto;padding:44px 28px 64px}
.eyebrow{color:var(--accent);font-size:10px;letter-spacing:.14em;font-weight:700}
.hero{background:var(--panel);border:1px solid var(--border);border-radius:20px;padding:30px;display:flex;align-items:center;gap:26px;margin:10px 0 18px;box-shadow:0 6px 24px #1a1d2b08}
.logo{width:120px;height:120px;flex:0 0 120px;border-radius:18px;background:${escapeHtml(
    primaryHex
  )}18;display:flex;align-items:center;justify-content:center;overflow:hidden}
.logo img{max-width:100%;max-height:100%;object-fit:contain;padding:12px}
.logo span{color:#fff;font-size:46px;font-weight:700;text-shadow:0 2px 8px #0002}
h1{font-size:34px;letter-spacing:-.5px;margin:6px 0 5px}
.tagline{color:var(--text-2);font-size:15px;margin:0 0 8px}
.desc{color:var(--text-3);font-size:12px;line-height:1.7;margin:0;max-width:680px}
.chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:4px}
.chip{font-size:10px;border-radius:5px;padding:3px 8px;background:${escapeHtml(
    primaryHex
  )}14;color:var(--accent);font-weight:600}
.chip.gray{background:#f0f1f6;color:var(--text-3);font-weight:500}
.grid{display:grid;grid-template-columns:1.35fr .9fr;gap:16px;align-items:start}
.card{background:var(--panel);border:1px solid var(--border);border-radius:15px;padding:20px;margin-bottom:16px}
.card h2{font-size:14px;margin:0 0 14px}
.colors{display:flex;flex-direction:column;gap:10px}
.color{border:1px solid var(--border);border-radius:10px;padding:11px;display:flex;gap:12px;align-items:flex-start}
.swatch{width:48px;height:48px;border-radius:9px;flex:0 0 48px;box-shadow:inset 0 0 0 1px #00000012}
.color-name{display:flex;align-items:center;gap:6px;font-size:12px}
.color-name em{font-style:normal;font-weight:600}
.color-name span{color:var(--text-3);font-size:9.5px;background:#f3f4f9;border-radius:4px;padding:1px 5px}
.color code{display:block;margin-top:3px;font-size:11px;color:var(--text)}
.color small{display:block;color:var(--text-3);font-size:10px;margin-top:2px;line-height:1.5}
.color p{color:var(--text-2);font-size:10.5px;margin:4px 0 0;line-height:1.5}
.type-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.type-sample{background:#fafbfe;border:1px solid var(--border);border-radius:10px;padding:14px}
.type-sample>span{color:var(--text-3);font-size:9.5px;font-weight:600}
.type-sample strong{display:block;font-size:22px;margin:7px 0 8px}
.type-sample p{color:var(--text-2);font-size:11.5px;line-height:1.75;margin:0}
.type-sample small{display:block;color:var(--text-3);font-size:9.5px;margin-top:8px}
.assets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.asset{margin:0;border-radius:9px;overflow:hidden;background:#f2f3f8}
.asset img{display:block;width:100%;aspect-ratio:1;object-fit:cover}
.asset figcaption{color:var(--text-3);font-size:9px;padding:5px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.file-tile{display:flex;align-items:center;justify-content:center;aspect-ratio:1;color:var(--text-3);font-size:12px;font-weight:700;background:#eef0f6}
.info{display:flex;flex-direction:column}
.info div{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #f1f2f7;padding:8px 0;font-size:11px}
.info div:last-child{border-bottom:0}
.info span{color:var(--text-3)}
.info strong{font-weight:500;text-align:right}
.usage{color:var(--text-2);font-size:12px;line-height:1.8;white-space:pre-wrap;margin:0}
.note{color:var(--text-3);font-size:10px;margin:8px 0 0;line-height:1.6}
footer{color:var(--text-3);font-size:10px;text-align:center;margin-top:26px}
@media(max-width:800px){.grid{grid-template-columns:1fr}.hero{flex-direction:column;align-items:flex-start}.assets{grid-template-columns:repeat(2,1fr)}.type-pair{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">
  <div class="eyebrow">PRODUCT MANUAL</div>
  <section class="hero">
    <div class="logo">${
      logoSource
        ? `<img src="${escapeHtml(logoSource)}" alt="${escapeHtml(product.name)}">`
        : `<span>${escapeHtml((product.name || '产').trim().slice(0, 1))}</span>`
    }</div>
    <div>
      <div class="chips">
        <span class="chip">${escapeHtml(
          PRODUCT_STATUS_LABELS[product.status] || '概念'
        )}</span>
        ${product.category ? `<span class="chip gray">${escapeHtml(product.category)}</span>` : ''}
        ${product.sku ? `<span class="chip gray">${escapeHtml(product.sku)}</span>` : ''}
      </div>
      <h1>${escapeHtml(product.name)}</h1>
      <p class="tagline">${escapeHtml(product.tagline || '')}</p>
      <p class="desc">${escapeHtml(product.description || '')}</p>
    </div>
  </section>

  <div class="grid">
    <div>
      <section class="card">
        <h2>产品色</h2>
        <div class="colors">${colors || '<p class="note">还没有产品色。</p>'}</div>
      </section>
      <section class="card">
        <h2>产品字体</h2>
        <div class="type-pair">
          <div class="type-sample">
            <span>标题</span>
            <strong>${escapeHtml(product.name)}</strong>
            <small>${escapeHtml(heading ? `${heading.family} · ${heading.name} · ${heading.weight}` : '继承品牌字体')}</small>
          </div>
          <div class="type-sample">
            <span>正文</span>
            <p>产品手册用于统一这个产品的视觉与表达。标题、正文和包装文案都从这里开始。</p>
            <small>${escapeHtml(body ? `${body.family} · ${body.name} · ${body.weight}` : '继承品牌字体')}</small>
          </div>
        </div>
      </section>
      <section class="card">
        <h2>产品素材 · ${assetEntries.length}</h2>
        ${
          assetEntries.length
            ? `<div class="assets">${assetEntries.map(assetHtml).join('')}</div>`
            : '<p class="note">这个产品还没有关联素材。</p>'
        }
      </section>
      <section class="card">
        <h2>产品使用规范</h2>
        <p class="usage">${escapeHtml(product.usage || '还没有填写产品使用规范。')}</p>
      </section>
    </div>
    <div>
      <section class="card">
        <h2>产品信息</h2>
        <div class="info">
          <div><span>品牌</span><strong>${escapeHtml(brand.name || '')}</strong></div>
          <div><span>状态</span><strong>${escapeHtml(
            PRODUCT_STATUS_LABELS[product.status] || '概念'
          )}</strong></div>
          <div><span>分类</span><strong>${escapeHtml(product.category || '—')}</strong></div>
          <div><span>产品编号</span><strong>${escapeHtml(product.sku || '—')}</strong></div>
          <div><span>上市日期</span><strong>${escapeHtml(product.launchDate || '—')}</strong></div>
        </div>
        ${
          product.logoNote || product.logoMinWidth || product.logoClearSpace
            ? `<p class="note">${escapeHtml(
                [
                  product.logoMinWidth ? `Logo 最小宽度 ${product.logoMinWidth}` : '',
                  product.logoClearSpace ? `安全边距 ${product.logoClearSpace}` : ''
                ]
                  .filter(Boolean)
                  .join(' · ')
              )}${product.logoNote ? `<br>${escapeHtml(product.logoNote)}` : ''}</p>`
            : ''
        }
      </section>
    </div>
  </div>
  <footer>${escapeHtml(brand.name || '')} · ${escapeHtml(
    product.name
  )} 产品手册 · 由 HyBrand 生成 · ${escapeHtml(exportedAt)}</footer>
</div>
</body>
</html>`
}

async function exportProductManual({ productId, destination }) {
  const state = store.getState()
  const product = store.getProduct(productId)
  if (!product) throw new Error('产品不存在')
  const brand = store.getBrand()
  const timestamp = stamp()
  const folder = await nextFolder(
    destination,
    `${sanitize(brand.name || 'brand', 'brand')}-${sanitize(
      product.name || 'product',
      'product'
    )}-product-manual-${timestamp}`
  )
  const filesDir = path.join(folder, 'files')
  const previewsDir = path.join(folder, 'previews')
  await fsp.mkdir(filesDir, { recursive: true })
  await fsp.mkdir(previewsDir, { recursive: true })

  const warnings = []
  const seen = new Set()
  const assetEntries = []
  const sourceAssets = productAssets(product)
  const logoAsset =
    product.logoAssetId &&
    state.assets.find(
      (asset) =>
        asset.id === product.logoAssetId &&
        asset.spaceId === state.activeSpaceId &&
        !asset.trashed
    )
  if (product.logoAssetId && !logoAsset) {
    warnings.push('产品 Logo 引用的素材已不存在')
  }
  const allAssets = [...(logoAsset ? [logoAsset] : []), ...sourceAssets]
  for (const asset of allAssets) {
    if (seen.has(asset.id)) continue
    seen.add(asset.id)
    const original = store.originalPath(asset)
    if (!(await exists(original))) {
      warnings.push(`素材「${asset.name}」文件不存在`)
      continue
    }
    const extension = path.extname(original) || (asset.ext ? `.${asset.ext}` : '')
    const index = String(assetEntries.length + 1).padStart(2, '0')
    const base = sanitize(asset.name.replace(/\.[^.]+$/, ''), 'asset')
    const fileName = `${index}-${base}${extension}`
    await fsp.copyFile(original, path.join(filesDir, fileName))
    let preview = null
    const previewSource = store.previewFilePath(asset)
    if (previewSource && (await exists(previewSource))) {
      const previewName = `${index}-${base}.png`
      await fsp.copyFile(previewSource, path.join(previewsDir, previewName))
      preview = `previews/${previewName}`
    }
    assetEntries.push({
      name: asset.name,
      hash: asset.hash || '',
      kind: asset.kind,
      ext: asset.ext,
      size: asset.size || 0,
      webImage: BROWSER_IMAGES.has(String(asset.ext || '').toLowerCase()),
      file: `files/${fileName}`,
      preview,
      role: logoAsset && asset.id === logoAsset.id ? 'logo' : 'asset'
    })
  }

  const logoEntry = assetEntries.find((entry) => entry.role === 'logo') || null
  const productFolder = product.folderId
    ? state.folders.find(
        (item) => item.id === product.folderId && item.spaceId === state.activeSpaceId
      )
    : null
  const heading = typefaceDescriptor(brand, product.headingTypefaceId)
  const body = typefaceDescriptor(brand, product.bodyTypefaceId)
  const exportedAt = new Date().toLocaleString('zh-CN')
  const html = renderHtml({
    brand,
    product,
    logoEntry,
    assetEntries: assetEntries.filter((entry) => entry.role !== 'logo'),
    heading,
    body,
    exportedAt
  })
  await fsp.writeFile(path.join(folder, 'index.html'), html, 'utf8')

  const manifest = {
    manifestVersion: 1,
    exportedAt: new Date().toISOString(),
    app: 'HyBrand',
    kind: 'product-manual',
    brand: { name: brand.name || '' },
    product: {
      name: product.name,
      tagline: product.tagline,
      description: product.description,
      category: product.category,
      status: product.status,
      launchDate: product.launchDate,
      sku: product.sku,
      logoLabel: product.logoLabel,
      logoMinWidth: product.logoMinWidth,
      logoClearSpace: product.logoClearSpace,
      logoNote: product.logoNote,
      logoFile: logoEntry?.file || null,
      logoHash: logoEntry?.hash || '',
      colors: product.colors.map((color) => ({
        name: color.name,
        hex: color.hex,
        pantone: color.pantone,
        category: color.category,
        usage: color.usage
      })),
      headingTypeface: heading,
      bodyTypeface: body,
      folderName: productFolder?.name || (product.folderId ? `${product.name} 素材` : null),
      hasFolder: Boolean(product.folderId),
      usage: product.usage
    },
    assets: assetEntries,
    warnings
  }
  await fsp.writeFile(
    path.join(folder, 'product.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  )
  await fsp.writeFile(
    path.join(folder, 'README.txt'),
    `HyBrand 产品手册\n\n打开 index.html 查看「${product.name}」产品手册。\n- files/ 下为产品素材原文件\n- previews/ 下为手册预览图\n- product.json 为结构化产品数据，可在 HyBrand 中导入\n\n生成时间：${exportedAt}\n`,
    'utf8'
  )

  return {
    path: folder,
    assets: assetEntries.length,
    colors: product.colors.length,
    warnings
  }
}

module.exports = { exportProductManual }
