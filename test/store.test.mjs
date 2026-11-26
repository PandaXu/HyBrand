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
    assert.equal(snapshot.version, 3)
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


test('store normalizes product manuals and clears invalid references', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hybrand-products-'))
  const now = new Date().toISOString()
  fs.writeFileSync(
    path.join(dir, 'library.json'),
    JSON.stringify({
      version: 2,
      spaces: [
        {
          id: 'space-1',
          name: '品牌空间',
          createdAt: now,
          brand: {
            name: '品牌空间',
            typography: [
              {
                id: 'type-1',
                assetId: 'font-1',
                role: 'brand',
                family: '产品字体',
                name: '产品字体',
                weight: 400
              }
            ]
          },
          products: [
            {
              id: 'product-1',
              name: '春日限定',
              description: '春季产品',
              colors: [{ name: '产品红', hex: '#ff0000' }],
              folderId: 'folder-1',
              logoAssetId: 'asset-1',
              headingTypefaceId: 'type-1',
              bodyTypefaceId: 'missing-typeface',
              createdAt: now,
              updatedAt: now
            },
            {
              id: 'product-2',
              name: '失效引用',
              folderId: 'missing-folder',
              logoAssetId: 'missing-asset',
              createdAt: now,
              updatedAt: now
            }
          ]
        }
      ],
      activeSpaceId: 'space-1',
      assets: [
        {
          id: 'asset-1',
          spaceId: 'space-1',
          name: 'logo.png',
          ext: 'png',
          kind: 'image',
          hash: 'logo-hash'
        },
        {
          id: 'font-1',
          spaceId: 'space-1',
          name: 'font.ttf',
          ext: 'ttf',
          kind: 'font',
          hash: 'font-hash'
        }
      ],
      folders: [{ id: 'folder-1', name: '产品素材', spaceId: 'space-1' }]
    })
  )

  try {
    store.init(dir)
    const snapshot = store.snapshot()
    assert.equal(snapshot.version, 3)
    assert.equal(snapshot.products.length, 2)
    assert.equal(snapshot.spaces[0].productCount, 2)
    const product = snapshot.products.find((item) => item.id === 'product-1')
    assert.equal(product.colors[0].hex, '#FF0000')
    assert.equal(product.folderId, 'folder-1')
    assert.equal(product.logoAssetId, 'asset-1')
    assert.equal(product.headingTypefaceId, 'type-1')
    assert.equal(product.bodyTypefaceId, null)
    const invalid = snapshot.products.find((item) => item.id === 'product-2')
    assert.equal(invalid.folderId, null)
    assert.equal(invalid.logoAssetId, null)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
