/**
 * 解析单段 HTTP Range（支持 bytes=start-end、bytes=start-、bytes=-suffix）。
 * 返回 null 表示应响应 416。
 */
function parseRange(header, size) {
  if (typeof header !== 'string' || !Number.isInteger(size) || size <= 0) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null

  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return null

  let start
  let end

  if (rawStart === '') {
    const suffix = Number(rawEnd)
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Number(rawEnd)
  }

  if (!Number.isInteger(start) || !Number.isInteger(end)) return null
  if (start < 0 || start >= size || end < start) return null
  if (end >= size) end = size - 1

  return { start, end }
}

module.exports = { parseRange }
