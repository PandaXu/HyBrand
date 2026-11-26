import { useEffect, useState } from 'react'
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Columns3,
  LayoutGrid,
  List,
  Search,
  Star,
  StretchHorizontal
} from 'lucide-react'
import {
  COLOR_FILTERS,
  KIND_LABELS,
  KIND_ORDER,
  SORT_OPTIONS,
  hasActiveFilters
} from '../utils.js'

const VIEWS = [
  { value: 'grid', label: '网格视图', Icon: LayoutGrid },
  { value: 'adaptive', label: '自适应视图', Icon: StretchHorizontal },
  { value: 'masonry', label: '瀑布流视图', Icon: Columns3 },
  { value: 'list', label: '列表视图', Icon: List }
]

function Popover({ children, className = '', onClose }) {
  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className={`filter-popover ${className}`}>{children}</div>
    </>
  )
}

export default function FilterBar({
  filters,
  tagOptions,
  kindCounts,
  colorCounts,
  actions,
  sort,
  viewMode,
  thumbSize,
  onSort,
  onViewMode,
  onThumbSize
}) {
  const [open, setOpen] = useState(null)
  const [sortOpen, setSortOpen] = useState(false)
  const [tagQuery, setTagQuery] = useState('')

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(null)
        setSortOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open !== 'tag') setTagQuery('')
  }, [open])

  const anyActive = hasActiveFilters(filters)
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label || '排序'
  const filteredTags = tagOptions.filter((tag) =>
    tag.value.toLowerCase().includes(tagQuery.trim().toLowerCase())
  )

  function toggle(name) {
    setSortOpen(false)
    setOpen((current) => (current === name ? null : name))
  }

  return (
    <div className="filterbar">
      <div className="filter-pills">
        <div className="filter-item">
          <button
            className={`filter-pill ${filters.kinds.length ? 'active' : ''}`}
            onClick={() => toggle('kind')}
          >
            格式
            {filters.kinds.length ? <span className="pill-badge">{filters.kinds.length}</span> : null}
            <ChevronDown size={12} />
          </button>
          {open === 'kind' ? (
            <Popover className="kind-popover" onClose={() => setOpen(null)}>
              {KIND_ORDER.map((kind) => {
                const selected = filters.kinds.includes(kind)
                return (
                  <button
                    key={kind}
                    className={`option-row ${selected ? 'selected' : ''}`}
                    onClick={() => actions.toggleKind(kind)}
                  >
                    <span className={`checkbox ${selected ? 'checked' : ''}`}>
                      {selected ? <Check size={11} /> : null}
                    </span>
                    <span className="option-label">{KIND_LABELS[kind]}</span>
                    <span className="option-count">{kindCounts.get(kind) || 0}</span>
                  </button>
                )
              })}
            </Popover>
          ) : null}
        </div>

        <div className="filter-item">
          <button
            className={`filter-pill ${filters.colors.length ? 'active' : ''}`}
            onClick={() => toggle('color')}
          >
            颜色
            {filters.colors.length ? <span className="pill-badge">{filters.colors.length}</span> : null}
            <ChevronDown size={12} />
          </button>
          {open === 'color' ? (
            <Popover className="color-popover" onClose={() => setOpen(null)}>
              <div className="color-grid">
                {COLOR_FILTERS.map((color) => {
                  const selected = filters.colors.includes(color.key)
                  return (
                    <button
                      key={color.key}
                      className={`color-option ${selected ? 'selected' : ''}`}
                      onClick={() => actions.toggleColor(color.key)}
                      title={`${color.label} ${colorCounts.get(color.key) || 0}`}
                    >
                      <span className="color-dot" style={{ background: color.hex }} />
                      <span>{color.label}</span>
                      <span className="option-count">{colorCounts.get(color.key) || 0}</span>
                    </button>
                  )
                })}
              </div>
            </Popover>
          ) : null}
        </div>

        <div className="filter-item">
          <button
            className={`filter-pill ${filters.tags.length ? 'active' : ''}`}
            onClick={() => toggle('tag')}
          >
            标签
            {filters.tags.length ? <span className="pill-badge">{filters.tags.length}</span> : null}
            <ChevronDown size={12} />
          </button>
          {open === 'tag' ? (
            <Popover className="tag-popover" onClose={() => setOpen(null)}>
              <div className="tag-mode-row">
                <span>标签匹配</span>
                <div className="segmented">
                  <button
                    className={filters.tagMode === 'any' ? 'active' : ''}
                    onClick={() => actions.setTagMode('any')}
                  >
                    任意符合
                  </button>
                  <button
                    className={filters.tagMode === 'all' ? 'active' : ''}
                    onClick={() => actions.setTagMode('all')}
                  >
                    全部符合
                  </button>
                </div>
              </div>
              <div className="tag-search">
                <Search size={13} />
                <input
                  value={tagQuery}
                  onChange={(event) => setTagQuery(event.target.value)}
                  placeholder="搜索标签"
                  spellCheck={false}
                />
              </div>
              <div className="tag-option-list">
                {filteredTags.map((tag) => {
                  const selected = filters.tags.includes(tag.value)
                  return (
                    <button
                      key={tag.value}
                      className={`option-row ${selected ? 'selected' : ''}`}
                      onClick={() => actions.toggleTag(tag.value)}
                    >
                      <span className={`checkbox ${selected ? 'checked' : ''}`}>
                        {selected ? <Check size={11} /> : null}
                      </span>
                      <span className="option-label">{tag.value}</span>
                      <span className="option-count">{tag.count}</span>
                    </button>
                  )
                })}
                {!filteredTags.length ? <div className="popover-empty">没有匹配的标签</div> : null}
              </div>
            </Popover>
          ) : null}
        </div>

        <div className="filter-item">
          <button
            className={`filter-pill ${filters.shape ? 'active' : ''}`}
            onClick={() => toggle('shape')}
          >
            形状
            {filters.shape ? <span className="pill-badge">1</span> : null}
            <ChevronDown size={12} />
          </button>
          {open === 'shape' ? (
            <Popover className="shape-popover" onClose={() => setOpen(null)}>
              <button
                className={`option-row ${filters.shape === 'landscape' ? 'selected' : ''}`}
                onClick={() => actions.setShape('landscape')}
              >
                <span className={`checkbox ${filters.shape === 'landscape' ? 'checked' : ''}`}>
                  {filters.shape === 'landscape' ? <Check size={11} /> : null}
                </span>
                <span className="option-label">横向素材</span>
              </button>
              <button
                className={`option-row ${filters.shape === 'portrait' ? 'selected' : ''}`}
                onClick={() => actions.setShape('portrait')}
              >
                <span className={`checkbox ${filters.shape === 'portrait' ? 'checked' : ''}`}>
                  {filters.shape === 'portrait' ? <Check size={11} /> : null}
                </span>
                <span className="option-label">竖向素材</span>
              </button>
            </Popover>
          ) : null}
        </div>

        <div className="filter-item">
          <button
            className={`filter-pill ${filters.date !== 'all' ? 'active' : ''}`}
            onClick={() => toggle('date')}
          >
            时间
            {filters.date !== 'all' ? <span className="pill-badge">1</span> : null}
            <ChevronDown size={12} />
          </button>
          {open === 'date' ? (
            <Popover className="date-popover" onClose={() => setOpen(null)}>
              {[
                ['7d', '最近 7 天'],
                ['30d', '最近 30 天'],
                ['year', '最近一年']
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`option-row ${filters.date === value ? 'selected' : ''}`}
                  onClick={() => actions.setDate(value)}
                >
                  <span className={`checkbox ${filters.date === value ? 'checked' : ''}`}>
                    {filters.date === value ? <Check size={11} /> : null}
                  </span>
                  <span className="option-label">{label}</span>
                </button>
              ))}
            </Popover>
          ) : null}
        </div>

        <button
          className={`filter-pill favorite-pill ${filters.favorite ? 'active' : ''}`}
          onClick={actions.toggleFavorite}
        >
          <Star size={13} fill={filters.favorite ? 'currentColor' : 'none'} />
          仅收藏
        </button>

        {anyActive ? (
          <button className="clear-filter" onClick={actions.clear}>
            清除筛选
          </button>
        ) : null}
      </div>

      <div className="toolbar-controls">
        <div className="filter-item sort-wrap">
          <button className="toolbar-btn" onClick={() => setSortOpen((value) => !value)}>
            <ArrowUpDown size={14} />
            <span>{sortLabel}</span>
            <ChevronDown size={12} />
          </button>
          {sortOpen ? (
            <>
              <div className="menu-backdrop" onClick={() => setSortOpen(false)} />
              <div className="floating-menu sort-menu">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className="check-menu-item"
                    onClick={() => {
                      onSort(option.value)
                      setSortOpen(false)
                    }}
                  >
                    <span className="menu-check">
                      {sort === option.value ? <Check size={13} /> : null}
                    </span>
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="view-switch">
          {VIEWS.map(({ value, label, Icon }) => (
            <button
              key={value}
              className={`view-btn ${viewMode === value ? 'active' : ''}`}
              onClick={() => onViewMode(value)}
              title={label}
              aria-label={label}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        {viewMode !== 'list' ? (
          <input
            className="thumb-slider"
            type="range"
            min="1"
            max="3"
            step="1"
            value={thumbSize}
            onChange={(event) => onThumbSize(Number(event.target.value))}
            title="缩略图大小"
            aria-label="缩略图大小"
          />
        ) : null}
      </div>
    </div>
  )
}
