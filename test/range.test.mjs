import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parseRange } = require('../electron/range.cjs')

test('parseRange: start-end', () => {
  assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 })
})

test('parseRange: open ended', () => {
  assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 })
})

test('parseRange: suffix', () => {
  assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 })
})

test('parseRange: suffix larger than file', () => {
  assert.deepEqual(parseRange('bytes=-5000', 1000), { start: 0, end: 999 })
})

test('parseRange: end clamped', () => {
  assert.deepEqual(parseRange('bytes=100-5000', 1000), { start: 100, end: 999 })
})

test('parseRange: invalid ranges', () => {
  assert.equal(parseRange('bytes=1000-', 1000), null)
  assert.equal(parseRange('bytes=10-5', 1000), null)
  assert.equal(parseRange('bytes=abc-def', 1000), null)
  assert.equal(parseRange('bytes=0-9,20-29', 1000), null)
  assert.equal(parseRange('bytes=-', 1000), null)
  assert.equal(parseRange('bytes=0-9', 0), null)
})
