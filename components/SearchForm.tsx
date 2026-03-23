'use client'

import { useState } from 'react'

const REGIONS = [
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
    region: string
    platforms: string[]
    dateFrom: string
    dateTo: string
  }) => void
  loading: boolean
}

export default function SearchForm({ onSearch, loading }: Props) {
  const [game, setGame] = useState('')
  const [keywords, setKeywords] = useState('更新, 試玩, 直播, 精華')
  const [region, setRegion] = useState('TW')
  const [platforms, setPlatforms] = useState<string[]>(['youtube', 'twitter', 'facebook'])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  function togglePlatform(p: string) {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!game.trim()) return
    onSearch({ game, keywords, region, platforms, dateFrom, dateTo })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-slate-400 text-xs mb-1 block">遊戲名稱 *</label>
          <input
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white placeholder-slate-500"
            placeholder="例：原神 / Genshin Impact"
            value={game}
            onChange={e => setGame(e.target.value)}
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-slate-400 text-xs mb-1 block">地區</label>
          <select
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
            value={region}
            onChange={e => setRegion(e.target.value)}
          >
            {REGIONS.map(r => (
              <option key={r.code} value={r.code}>{r.label}（{r.code}）</option>
            ))}
          </select>
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

      <div>
        <label className="text-slate-400 text-xs mb-2 block">平台</label>
        <div className="flex gap-3">
          {[
            { id: 'youtube', label: 'YouTube' },
            { id: 'twitter', label: 'Twitter/X' },
            { id: 'facebook', label: 'Facebook' },
          ].map(p => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={platforms.includes(p.id)}
                onChange={() => togglePlatform(p.id)}
                className="accent-blue-500"
              />
              <span className="text-slate-300 text-sm">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !game.trim()}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2.5 rounded-lg transition-colors"
      >
        {loading ? '分析中...' : '▶ 開始分析'}
      </button>
    </form>
  )
}
