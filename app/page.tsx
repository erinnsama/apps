'use client'

import { useState, useMemo } from 'react'
import SearchForm from '@/components/SearchForm'
import ResultCard from '@/components/ResultCard'
import KOLPanel from '@/components/KOLPanel'
import type { SearchResult } from '@/lib/types'

type SortKey = 'score' | 'date' | 'views'
type ViewTab = 'videos' | 'kol'

export default function Home() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const [apiErrors, setApiErrors] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [minScore, setMinScore] = useState(0)
  const [platformFilter, setPlatformFilter] = useState('all')
  const [viewTab, setViewTab] = useState<ViewTab>('videos')

  async function handleSearch(params: any) {
    setLoading(true)
    setSearched(false)
    setResults([])
    setExportMsg('')
    setApiErrors([])
    setSortKey('score')
    setMinScore(0)
    setPlatformFilter('all')
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const data = await res.json()
      setResults(data.results || [])
      setApiErrors(data.errors || [])
    } catch {
      setResults([])
    }
    setLoading(false)
    setSearched(true)
  }

  const platformCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of results) map[r.platform] = (map[r.platform] || 0) + 1
    return map
  }, [results])

  const scoreCounts = useMemo(() => ({
    3: results.filter(r => r.score === 3).length,
    2: results.filter(r => r.score >= 2).length,
  }), [results])

  const filtered = useMemo(() => {
    let list = results
    if (minScore > 0) list = list.filter(r => r.score >= minScore)
    if (platformFilter !== 'all') list = list.filter(r => r.platform === platformFilter)
    return [...list].sort((a, b) => {
      if (sortKey === 'score') return b.score - a.score
      if (sortKey === 'date') return (b.publishedAt || '').localeCompare(a.publishedAt || '')
      if (sortKey === 'views') return (b.viewCount || 0) - (a.viewCount || 0)
      return 0
    })
  }, [results, sortKey, minScore, platformFilter])

  async function handleExport(sheetId: string) {
    setExportMsg('匯出中...')
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: filtered, sheetId }),
      })
      const data = await res.json()
      if (data.ok) setExportMsg('✓ 已匯出至 Google Sheets')
      else setExportMsg('匯出失敗：' + data.error)
    } catch {
      setExportMsg('匯出失敗')
    }
  }

  const PLATFORM_COLORS: Record<string, string> = {
    youtube: 'bg-red-900/50 text-red-300 border-red-800/50',
    instagram: 'bg-pink-900/50 text-pink-300 border-pink-800/50',
    twitter: 'bg-sky-900/50 text-sky-300 border-sky-800/50',
    facebook: 'bg-blue-900/50 text-blue-300 border-blue-800/50',
  }
  const PLATFORM_LABEL: Record<string, string> = {
    youtube: 'YouTube', instagram: 'Instagram', twitter: 'Twitter/X', facebook: 'Facebook',
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Game Intel Tracker</h1>
        <p className="text-slate-400 text-sm">遊戲競品跨平台合作偵測系統</p>
      </div>

      <SearchForm onSearch={handleSearch} loading={loading} />

      {loading && (
        <div className="mt-10 text-center text-slate-400">
          <div className="inline-block w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mb-2" />
          <p>分析中，請稍候...</p>
        </div>
      )}

      {!loading && searched && (
        <div className="mt-8">
          {/* View Tab */}
          <div className="flex gap-1 mb-5 bg-slate-800/60 border border-slate-700 rounded-lg p-1 w-fit">
            <button
              onClick={() => setViewTab('videos')}
              className={`text-sm px-4 py-1.5 rounded-md transition-colors ${viewTab === 'videos' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              影片列表
            </button>
            <button
              onClick={() => setViewTab('kol')}
              className={`text-sm px-4 py-1.5 rounded-md transition-colors ${viewTab === 'kol' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              KOL 頻道
            </button>
          </div>

          {viewTab === 'videos' && (
            <>
              {/* Summary */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <p className="text-slate-300 text-sm">
                  共 <span className="text-white font-bold">{results.length}</span> 筆
                  {scoreCounts[3] > 0 && <span className="text-orange-400 ml-2">★★★ {scoreCounts[3]} 筆</span>}
                  {scoreCounts[2] > 0 && <span className="text-yellow-400 ml-1">★★ {scoreCounts[2]} 筆</span>}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(platformCounts).map(([p, count]) => (
                    <button
                      key={p}
                      onClick={() => setPlatformFilter(platformFilter === p ? 'all' : p)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-opacity ${PLATFORM_COLORS[p] || 'bg-slate-700 text-slate-300 border-slate-600'} ${platformFilter !== 'all' && platformFilter !== p ? 'opacity-40' : ''}`}
                    >
                      {PLATFORM_LABEL[p] || p} {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter + Sort */}
              {results.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs">評分：</span>
                    {[0, 2, 3].map(s => (
                      <button
                        key={s}
                        onClick={() => setMinScore(s)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${minScore === s ? 'bg-slate-600 border-slate-400 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
                      >
                        {s === 0 ? '全部' : s === 2 ? '★★+' : '★★★'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs">排序：</span>
                    {(['score', 'date', 'views'] as SortKey[]).map(k => (
                      <button
                        key={k}
                        onClick={() => setSortKey(k)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${sortKey === k ? 'bg-slate-600 border-slate-400 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
                      >
                        {k === 'score' ? '評分' : k === 'date' ? '日期' : '觀看數'}
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto">
                    <ExportPanel onExport={handleExport} msg={exportMsg} />
                  </div>
                </div>
              )}

              {apiErrors.length > 0 && (
                <div className="mb-4 space-y-1">
                  {apiErrors.map((e, i) => (
                    <p key={i} className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{e}</p>
                  ))}
                </div>
              )}

              {filtered.length === 0 ? (
                <p className="text-slate-500 text-center mt-10">沒有找到符合條件的內容</p>
              ) : (
                <div className="space-y-3">
                  {filtered.map((r, i) => <ResultCard key={i} result={r} />)}
                </div>
              )}
            </>
          )}

          {viewTab === 'kol' && (
            <>
              {apiErrors.length > 0 && (
                <div className="mb-4 space-y-1">
                  {apiErrors.map((e, i) => (
                    <p key={i} className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{e}</p>
                  ))}
                </div>
              )}
              <KOLPanel results={results} />
            </>
          )}
        </div>
      )}
    </main>
  )
}

function ExportPanel({ onExport, msg }: { onExport: (id: string) => void; msg: string }) {
  const [sheetId, setSheetId] = useState('')
  return (
    <div className="flex items-center gap-2">
      <input
        className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 w-52"
        placeholder="Google Sheet ID（選填）"
        value={sheetId}
        onChange={e => setSheetId(e.target.value)}
      />
      <button
        onClick={() => onExport(sheetId)}
        className="bg-green-700 hover:bg-green-600 text-white text-sm px-4 py-1.5 rounded whitespace-nowrap"
      >
        匯出 Sheets
      </button>
      {msg && <span className="text-slate-400 text-xs">{msg}</span>}
    </div>
  )
}
