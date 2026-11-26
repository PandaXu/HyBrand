import { create } from 'zustand'
import api from './api.js'
import { emptyFilters } from './utils.js'

const PREFS_KEY = 'hybrand:prefs'

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistPrefs(state) {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        viewMode: state.viewMode,
        thumbSize: state.thumbSize,
        sort: state.sort
      })
    )
  } catch {
    // 忽略 localStorage 不可用
  }
}

const prefs = loadPrefs()
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`
const toggleIn = (list, value) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

export const useApp = create((set, get) => ({
  library: {
    assets: [],
    folders: [],
    spaces: [],
    activeSpaceId: null,
    brand: null,
    stats: { active: 0, trash: 0, bytes: 0, total: 0 },
    dataDir: ''
  },
  ready: false,
  nav: { type: 'all' },
  search: '',
  filters: emptyFilters(),
  sort: prefs.sort || 'imported-desc',
  viewMode: prefs.viewMode || 'grid',
  thumbSize: prefs.thumbSize || 2,
  selection: [],
  activeId: null,
  lightboxId: null,
  similar: null,
  dragging: false,
  dialog: null,
  toasts: [],
  expandedFolders: [],

  setLibrary: (snapshot) =>
    set((state) => {
      const spaceChanged =
        Boolean(state.library.activeSpaceId) &&
        state.library.activeSpaceId !== snapshot.activeSpaceId
      if (spaceChanged) {
        if (state.similar?.token) api.clearSearchTemp(state.similar.token).catch(() => {})
        return {
          library: snapshot,
          ready: true,
          nav: { type: 'all' },
          search: '',
          filters: emptyFilters(),
          selection: [],
          activeId: null,
          lightboxId: null,
          similar: null,
          expandedFolders: [],
          dialog: null
        }
      }
      const ids = new Set(snapshot.assets.map((asset) => asset.id))
      const selection = state.selection.filter((id) => ids.has(id))
      const activeId = state.activeId && ids.has(state.activeId) ? state.activeId : null
      const lightboxId = state.lightboxId && ids.has(state.lightboxId) ? state.lightboxId : null
      return { library: snapshot, ready: true, selection, activeId, lightboxId }
    }),

  setNav: (nav) => {
    get().clearSimilar()
    set({
      nav,
      search: '',
      filters: emptyFilters(),
      selection: [],
      activeId: null,
      lightboxId: null
    })
  },

  setSearch: (search) => set({ search, selection: [], activeId: null }),

  toggleKind: (kind) =>
    set((state) => ({
      filters: { ...state.filters, kinds: toggleIn(state.filters.kinds, kind) },
      selection: [],
      activeId: null
    })),
  toggleColor: (color) =>
    set((state) => ({
      filters: { ...state.filters, colors: toggleIn(state.filters.colors, color) },
      selection: [],
      activeId: null
    })),
  toggleTag: (tag) =>
    set((state) => ({
      filters: { ...state.filters, tags: toggleIn(state.filters.tags, tag) },
      selection: [],
      activeId: null
    })),
  setTagMode: (tagMode) => set((state) => ({ filters: { ...state.filters, tagMode } })),
  setShape: (shape) =>
    set((state) => ({
      filters: { ...state.filters, shape: state.filters.shape === shape ? null : shape },
      selection: [],
      activeId: null
    })),
  setDate: (date) =>
    set((state) => ({
      filters: { ...state.filters, date: state.filters.date === date ? 'all' : date },
      selection: [],
      activeId: null
    })),
  toggleFavoriteFilter: () =>
    set((state) => ({
      filters: { ...state.filters, favorite: !state.filters.favorite },
      selection: [],
      activeId: null
    })),
  clearFilters: () => set({ filters: emptyFilters(), selection: [], activeId: null }),

  setSort: (sort) => {
    set({ sort })
    persistPrefs(get())
  },
  setViewMode: (viewMode) => {
    set({ viewMode })
    persistPrefs(get())
  },
  setThumbSize: (thumbSize) => {
    set({ thumbSize })
    persistPrefs(get())
  },

  select: (id, { meta = false, shift = false, visibleIds = [] } = {}) =>
    set((state) => {
      if (shift && state.activeId) {
        const anchor = visibleIds.indexOf(state.activeId)
        const target = visibleIds.indexOf(id)
        if (anchor >= 0 && target >= 0) {
          const start = Math.min(anchor, target)
          const end = Math.max(anchor, target)
          const range = visibleIds.slice(start, end + 1)
          const selection = meta
            ? [...new Set([...state.selection, ...range])]
            : range
          return { selection, activeId: id }
        }
      }
      if (meta) {
        const has = state.selection.includes(id)
        const selection = has
          ? state.selection.filter((item) => item !== id)
          : [...state.selection, id]
        return {
          selection,
          activeId: has ? selection[selection.length - 1] || null : id
        }
      }
      return { selection: [id], activeId: id }
    }),

  toggleChecked: (id) =>
    set((state) => {
      const has = state.selection.includes(id)
      const selection = has
        ? state.selection.filter((item) => item !== id)
        : [...state.selection, id]
      return {
        selection,
        activeId: has ? selection[selection.length - 1] || null : id
      }
    }),

  selectAll: (ids) => set({ selection: ids, activeId: ids[ids.length - 1] || null }),
  clearSelection: () => set({ selection: [], activeId: null }),
  setActiveId: (activeId) => set({ activeId, selection: activeId ? [activeId] : [] }),


  openLightbox: (lightboxId) => set({ lightboxId }),
  closeLightbox: () => set({ lightboxId: null }),

  setSimilar: (payload) => {
    const previous = get().similar
    if (previous && previous.token && previous.token !== payload.token) {
      api.clearSearchTemp(previous.token).catch(() => {})
    }
    set({
      similar: payload,
      selection: [],
      activeId: null,
      lightboxId: null,
      search: ''
    })
  },
  clearSimilar: () => {
    const similar = get().similar
    if (!similar) return
    if (similar.token) api.clearSearchTemp(similar.token).catch(() => {})
    set({ similar: null, selection: [], activeId: null })
  },

  setDragging: (dragging) => set({ dragging }),
  toggleFolder: (id) =>
    set((state) => ({
      expandedFolders: state.expandedFolders.includes(id)
        ? state.expandedFolders.filter((item) => item !== id)
        : [...state.expandedFolders, id]
    })),
  expandFolder: (id) =>
    set((state) =>
      state.expandedFolders.includes(id)
        ? {}
        : { expandedFolders: [...state.expandedFolders, id] }
    ),

  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),

  toast: (message, type = 'info', action = null) => {
    const id = uid()
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { id, message, type, action }]
    }))
    setTimeout(() => get().dismissToast(id), action ? 6500 : 3600)
    return id
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}))
