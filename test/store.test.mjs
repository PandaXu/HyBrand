import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const store = require('../electron/store.cjs')

test('store migrates a v1 library into a default brand space', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrand-store-'))
  const now = new Date().toISOString()
  fs.writeFileSync(
    path.join(dir, 'library.json'),
    JSON.stringify({
      version: 1,
      brand: {
        id: 'brand-1',
        name: '旧品牌',
        colors: [{ id: 'c1', name: '主色', hex: '#FF5C8A' }],
        typography: [
          { id: 't1', assetId: 'font-1', role: 'brand', name: '旧字体', weight: 400 }
        ],
        typeScale: {
          base: 16,
          ratio: 1.25,
          headingWeight: 600,
          bodyWeight: 400
        },
        pairingNote: '旧版搭配说明'
      },
      assets: [
        {
          id: 'asset-1',
          name: '旧素材.png',
          ext: 'png',
          kind: 'image',
          size: 10,
          hash: 'hash-1',
          folderId: 'folder-1',
          importedAt: now,
          updatedAt: now
        },
        {
          id: 'font-1',
          name: '旧字体.ttf',
          ext: 'ttf',
          kind: 'font',
          size: 10,
          hash: 'hash-2',
          importedAt: now,
          updatedAt: now
        }
      ],
      folders: [{ id: 'folder-1', name: '品牌素材', parentId: null, createdAt: now }],
      settings: {}
    })
  )

  try {
    store.init(dir)
    const snapshot = store.snapshot()
    assert.equal(snapshot.version, 2)
    assert.equal(snapshot.spaces.length, 1)
    assert.equal(snapshot.spaces[0].name, '旧品牌')
    assert.equal(snapshot.activeSpaceId, snapshot.spaces[0].id)
    assert.equal(snapshot.brand.name, '旧品牌')
    assert.equal(snapshot.assets.length, 2)
    assert.ok(snapshot.assets.every((asset) => asset.spaceId === snapshot.activeSpaceId))
    assert.equal(snapshot.folders[0].spaceId, snapshot.activeSpaceId)
    assert.equal(snapshot.brand.typography[0].family, '旧字体')
    const step = snapshot.brand.typeScale.steps.display
    assert.equal(step.typefaceId, 't1')
    assert.equal(snapshot.brand.pairings.length, 1)
    assert.equal(snapshot.brand.pairings[0].note, '旧版搭配说明')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
