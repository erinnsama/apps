'use client'

import { useState } from 'react'

const ALL_REGIONS = [
  { code: 'TW', label: '台灣' },
  { code: 'JP', label: '日本' },
  { code: 'KR', label: '韓國' },
  { code: 'US', label: '美國' },
  { code: 'PH', label: '菲律賓' },
  { code: 'VN', label: '越南' },
  { code: 'TH', label: '泰國' },
]

interface Props {
  onSearch: (params: {
    game: string
    keywords: string
    regions: string[]
    regionalNames: Record<string, string>
    platforms: string[]
    dateFrom: string
    dateTo: string
    order: string
    minViews: number
  }) => void
  loading: boolean
}

export default function SearchForm({ onSearch, loading }: Props) {
  const [game, setGame] = useState('')
  const [keywords, setKeywords] = useState('')
  const [regions, setRegions] = useState<string[]>(['TW'])
  const [platforms, setPlatforms] = useState<string[]>(['youtube'])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [order, setOrder] = useState('relevance')
  const [minViews, setMinViews] = useState('')
  const [regionalNames, setRegionalNames] = useState<Record<string, string>>({})

  function toggleRegion(code: string) {
    setRegions(prev =>
      prev.includes(code) ? prev.filter(r => r !== code) : [...prev, code]
    )
  }

  function togglePlatform(p: string) {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  function handleGameChange(val: string) {
    setGame(val)
    // Reset all regional names when game changes
    setRegionalNames({})
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!game.trim() || regions.length === 0) return
    onSearch({
      game,
      keywords,
      regions,
      regionalNames,
      platforms,
      dateFrom,
      dateTo,
      order,
      minViews: Number(minViews) || 0,
    })
  }

  const multiRegion = regions.length > 1

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
      {/* Game + Keywords */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-slate-400 text-xs mb-1 block">遊戲名稱 *</label>
          <input
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500"
            placeholder="例：噠噠特攻 / 原神"
            value={game}
            onChange={e => handleGameChange(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">額外關鍵字（逗號分隔）</label>
          <input
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500"
            placeholder="例：更新, 試玩, 直播, 精華"
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
          />
        </div>
      </div>

      {/* Regions multi-select */}
      <div>
        <label className="text-slate-400 text-xs mb-2 block">搜尋地區（可複選）</label>
        <div className="flex flex-wrap gap-2">
          {ALL_REGIONS.map(r => (
            <button
              key={r.code}
              type="button"
              onClick={() => toggleRegion(r.code)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                regions.includes(r.code)
                  ? 'bg-blue-700 border-blue-500 text-white'
                  : 'border-slate-600 text-slate-400 hover:border-slate-400'
              }`}
            >
              {r.label}（{r.code}）
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRegions(ALL_REGIONS.map(r => r.code))}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-400 hover:border-slate-400 transition-colors"
          >
            全選
          </button>
          <button
            type="button"
            onClick={() => setRegions([])}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-400 hover:border-slate-400 transition-colors"
          >
            清除
          </button>
        </div>
      </div>

      {/* Regional name overrides — shown when multiple regions selected */}
      {multiRegion && game.trim() && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
          <p className="text-slate-400 text-xs mb-2">各地區遊戲名稱（不填則沿用上方名稱）</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ALL_REGIONS.filter(r => regions.includes(r.code)).map(r => (
              <div key={r.code}>
                <label className="text-slate-500 text-xs block mb-0.5">{r.label}（{r.code}）</label>
                <input
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs placeholder-slate-600"
                  placeholder={game}
                  value={regionalNames[r.code] || ''}
                  onChange={e => setRegionalNames(prev => ({ ...prev, [r.code]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <p className="text-slate-600 text-xs mt-2">例：噠噠特攻 → JP填「ダダサバイバー」、KR填「탕탕특공대」、US填「survivor.io」</p>
        </div>
      )}

      {/* Options row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-slate-400 text-xs mb-1 block">排序方式</label>
          <select
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
            value={order}
            onChange={e => setOrder(e.target.value)}
          >
            <option value="relevance">相關度</option>
            <option value="date">最新發布</option>
            <option value="viewCount">觀看數</option>
          </select>
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">最低觀看數</label>
          <input
            type="number"
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500"
            placeholder="不限"
            value={minViews}
            onChange={e => setMinViews(e.target.value)}
            min={0}
          />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">日期起</label>
          <input
            type="date"
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1 block">日期迄</label>
          <input
            type="date"
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Platforms */}
      <div>
        <label className="text-slate-400 text-xs mb-2 block">平台</label>
        <div className="flex gap-4">
          {[
            { id: 'youtube', label: 'YouTube', color: 'accent-red-500' },
            { id: 'instagram', label: 'Instagram', color: 'accent-pink-500' },
            { id: 'twitter', label: 'Twitter/X', color: 'accent-sky-500' },
          ].map(p => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={platforms.includes(p.id)}
                onChange={() => togglePlatform(p.id)}
                className={p.color}
              />
              <span className="text-slate-300 text-sm">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !game.trim() || regions.length === 0}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2.5 rounded-lg transition-colors"
      >
        {loading ? '分析中...' : `▶ 開始分析${regions.length > 1 ? `（${regions.length} 個地區）` : ''}`}
      </button>
    </form>
  )
}
