import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  brandCompletion,
  colorValues,
  contrastInfo,
  fontFamilies,
  pairingsResolved,
  typeScaleSteps
} from '../renderer/brand.js'

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

test('contrastInfo: WCAG black and white', () => {
  const black = contrastInfo('#000000')
  assert.equal(black.white, 21)
  assert.equal(black.whiteAA, true)
  assert.equal(black.whiteAAA, true)
  assert.equal(black.blackAA, false)
  const white = contrastInfo('#FFFFFF')
  assert.equal(white.black, 21)
  assert.equal(white.blackAAA, true)
})

test('typeScaleSteps: maps each step to a specific font variant', () => {
  const brand = {
    name: '测试品牌',
    typeScale: {
      base: 16,
      ratio: 1.25,
      steps: {
        display: { typefaceId: 'f1' },
        h1: { typefaceId: 'f1' },
        h2: { typefaceId: 'f1' },
        h3: { typefaceId: 'f1' },
        body: { typefaceId: 'f2' },
        caption: { typefaceId: 'f2' }
      }
    },
    typography: [
      { id: 'f1', assetId: 'a1', role: 'heading', family: '测试无衬线', name: 'Bold', weight: 700 },
      { id: 'f2', assetId: 'a2', role: 'body', family: '测试无衬线', name: 'Regular', weight: 400 }
    ]
  }
  const assets = [
    { id: 'a1', kind: 'font', trashed: false },
    { id: 'a2', kind: 'font', trashed: false }
  ]
  const steps = typeScaleSteps(brand, assets)
  assert.equal(steps.length, 6)
  assert.equal(steps.find((step) => step.key === 'body').size, 16)
  assert.equal(steps.find((step) => step.key === 'h1').size, 31.3)
  assert.equal(steps.find((step) => step.key === 'display').size, 39.1)
  assert.equal(steps.find((step) => step.key === 'display').weight, 700)
  assert.equal(steps.find((step) => step.key === 'display').family, 'BrandFont-a1')
  assert.equal(steps.find((step) => step.key === 'body').weight, 400)
  assert.equal(steps.find((step) => step.key === 'body').family, 'BrandFont-a2')
})

test('fontFamilies: groups variants by family and pairings resolve both fonts', () => {
  const brand = {
    typography: [
      { id: 'f1', assetId: 'a1', family: '无衬线', name: 'Bold', weight: 700 },
      { id: 'f2', assetId: 'a2', family: '无衬线', name: 'Regular', weight: 400 },
      { id: 'f3', assetId: 'a3', family: '衬线', name: 'Serif', weight: 400 }
    ],
    pairings: [
      { id: 'p1', name: '主搭配', headingTypefaceId: 'f1', bodyTypefaceId: 'f2', note: '' }
    ]
  }
  const assets = [
    { id: 'a1', kind: 'font', trashed: false },
    { id: 'a2', kind: 'font', trashed: false },
    { id: 'a3', kind: 'font', trashed: false }
  ]
  const families = fontFamilies(brand, assets)
  assert.equal(families.length, 2)
  assert.equal(families.find((family) => family.name === '无衬线').variants.length, 2)
  const pairings = pairingsResolved(brand, assets)
  assert.equal(pairings[0].heading.weight, 700)
  assert.equal(pairings[0].body.weight, 400)
})
