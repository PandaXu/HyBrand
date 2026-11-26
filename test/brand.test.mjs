import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { brandCompletion, colorValues } from '../renderer/brand.js'

const require = createRequire(import.meta.url)
const { colorValues: exportColorValues } = require('../electron/brand-export.cjs')

test('colorValues: hex/rgb/hsl/cmyk', () => {
  const red = colorValues('#FF0000')
  assert.equal(red.hex, '#FF0000')
  assert.equal(red.rgb, '255, 0, 0')
  assert.equal(red.hsl, '0°, 100%, 50%')
  assert.equal(red.cmyk, '0%, 100%, 100%, 0%')
})

test('brandCompletion: tracks required and recommended items', () => {
  const brand = {
    name: '测试品牌',
    tagline: '',
    description: '',
    voice: '克制',
    colors: [{ id: 'c1', name: '主色', hex: '#FF5C8A' }],
    logoVariants: [
      { id: 'l1', assetId: 'a1', role: 'primary', minWidth: '120px', clearSpace: '' }
    ],
    typography: []
  }
  const assets = [
    { id: 'a1', kind: 'image', ext: 'svg', trashed: false },
    { id: 'f1', kind: 'font', ext: 'ttf', trashed: false }
  ]
  const completion = brandCompletion(brand, assets)
  assert.ok(completion.score > 0 && completion.score < 100)
  assert.equal(completion.requiredDone, 4)
  assert.equal(completion.requiredTotal, 5)
  assert.equal(completion.items.find((item) => item.key === 'primary-logo').done, true)
  assert.equal(completion.items.find((item) => item.key === 'reverse-logo').done, false)
})

test('brandCompletion: missing referenced assets are not counted', () => {
  const brand = {
    name: '测试品牌',
    tagline: '定位',
    description: '简介',
    voice: '语气',
    colors: [{ id: 'c1', name: '主色', hex: '#5B6CFF' }],
    logoVariants: [{ id: 'l1', assetId: 'missing', role: 'primary' }],
    typography: [{ id: 't1', assetId: 'missing2', role: 'brand' }]
  }
  const completion = brandCompletion(brand, [])
  assert.equal(completion.items.find((item) => item.key === 'primary-logo').done, false)
  assert.equal(completion.items.find((item) => item.key === 'typeface').done, false)
  assert.ok(completion.insights.some((insight) => insight.includes('主 Logo')))
})

test('export color values match renderer', () => {
  for (const hex of ['#FF5C8A', '#5B6CFF', '#000000', '#FFFFFF', '#12A594']) {
    assert.deepEqual(exportColorValues(hex), colorValues(hex))
  }
})
