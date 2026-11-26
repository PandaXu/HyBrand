const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const fs = require('node:fs')
const path = require('node:path')
const { app } = require('electron')
const labelsZh = require('./vision-labels-zh.cjs')

const execFileAsync = promisify(execFile)

function helperPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'bin', 'hybrand-vision')
  return path.join(__dirname, '..', 'resources', 'bin', 'hybrand-vision')
}

function parseOutput(stdout) {
  const text = String(stdout || '').trim()
  const line = text.split('\n').filter(Boolean).pop() || ''
  const data = JSON.parse(line)
  if (data.error) throw new Error(data.error)

  const seen = new Set()
  const labels = []
  for (const item of data.labels || []) {
    const id = String(item.id || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    labels.push({
      label: id,
      zh: labelsZh[id] || null,
      score: Math.round((Number(item.confidence) || 0) * 1000) / 1000
    })
    if (labels.length >= 12) break
  }

  const featureBuffer = data.feature ? Buffer.from(data.feature, 'base64') : null
  const colors = Array.isArray(data.colors)
    ? data.colors.filter((color) => /^#[0-9a-f]{6}$/i.test(color))
    : []

  return {
    labels,
    featureBuffer,
    featureCount:
      Number(data.featureCount) ||
      (featureBuffer ? Math.floor(featureBuffer.byteLength / 4) : 0),
    width: Number.isFinite(data.width) ? Math.round(data.width) : null,
    height: Number.isFinite(data.height) ? Math.round(data.height) : null,
    duration: Number.isFinite(data.duration) ? data.duration : null,
    colors
  }
}

async function analyze(filePath, previewOutPath = null) {
  const helper = helperPath()
  if (!fs.existsSync(helper)) {
    throw new Error('本地 AI 组件未构建，请先运行 npm run build:vision')
  }

  let stdout = ''
  try {
    const args = ['analyze', filePath]
    if (previewOutPath) args.push(previewOutPath)
    const result = await execFileAsync(helper, args, {
      timeout: 60000,
      maxBuffer: 32 * 1024 * 1024
    })
    stdout = result.stdout
  } catch (error) {
    let message = '本地 AI 分析失败'
    const raw = String(error.stdout || '').trim()
    if (raw) {
      try {
        const parsed = JSON.parse(raw.split('\n').filter(Boolean).pop())
        if (parsed.error) message = parsed.error
      } catch {
        // 保留默认错误信息
      }
    }
    if (error.killed) message = '本地 AI 分析超时'
    throw new Error(message)
  }

  return parseOutput(stdout)
}

module.exports = { analyze, helperPath }
