import api, { errorMessage } from './api.js'
import { useApp } from './store.js'

export async function callApi(promise, fallback = '操作失败') {
  try {
    return await promise
  } catch (error) {
    useApp.getState().toast(errorMessage(error, fallback), 'error')
    return null
  }
}

export function toast(message, type = 'info') {
  return useApp.getState().toast(message, type)
}

export { api }
