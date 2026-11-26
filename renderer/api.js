const api = window.hybrand

export function errorMessage(error, fallback = '操作失败') {
  const raw = error && error.message ? String(error.message) : ''
  if (!raw) return fallback
  return raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim() || fallback
}

export default api
