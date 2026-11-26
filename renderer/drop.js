import api from './api.js'

export const ASSET_MIME = 'application/x-hybrand-assets'

export function hasInternalAssets(dataTransfer) {
  return Array.from(dataTransfer?.types || []).includes(ASSET_MIME)
}

export function hasFiles(dataTransfer) {
  return Array.from(dataTransfer?.types || []).includes('Files')
}

export function readAssetIds(dataTransfer) {
  try {
    const raw = dataTransfer.getData(ASSET_MIME)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === 'string' && id.length > 0)
      : []
  } catch {
    return []
  }
}

export function readFilePaths(dataTransfer) {
  const paths = []
  for (const file of Array.from(dataTransfer?.files || [])) {
    try {
      const filePath = api.getPathForFile(file)
      if (filePath) paths.push(filePath)
    } catch {
      // 忽略无法解析的文件
    }
  }
  return paths
}
