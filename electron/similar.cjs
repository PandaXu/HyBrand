const fs = require('node:fs')
const store = require('./store.cjs')

const cache = new Map()

function floatsFromBuffer(buffer) {
  const usable = buffer.byteLength - (buffer.byteLength % 4)
  if (usable <= 0) return null
  const storage = new ArrayBuffer(usable)
  new Uint8Array(storage).set(buffer.subarray(0, usable))
  return new Float32Array(storage)
}

function featureFor(asset) {
  if (!asset || !asset.featurePath) return null
  if (cache.has(asset.id)) return cache.get(asset.id)
  try {
    const raw = fs.readFileSync(store.featureFilePath(asset))
    const floats = floatsFromBuffer(raw)
    if (floats) cache.set(asset.id, floats)
    return floats
  } catch {
    return null
  }
}

function featureForAsset(assetId) {
  return featureFor(store.getAsset(assetId))
}

function invalidate(assetId) {
  cache.delete(assetId)
}

function rank(reference, { excludeId = null, limit = 200 } = {}) {
  if (!reference || !reference.length) return []
  const results = []
  for (const asset of store.getState().assets) {
    if (asset.trashed || asset.id === excludeId || !asset.featurePath) continue
    const feature = featureFor(asset)
    if (!feature || feature.length !== reference.length) continue
    let sum = 0
    for (let i = 0; i < reference.length; i += 1) {
      const delta = reference[i] - feature[i]
      sum += delta * delta
    }
    results.push({ id: asset.id, distance: sum })
  }
  results.sort((a, b) => a.distance - b.distance)
  // ponytail: 线性扫描全部特征，几百到数千素材足够；更大规模再上向量索引。
  return results.slice(0, limit)
}

module.exports = { floatsFromBuffer, featureFor, featureForAsset, invalidate, rank }
