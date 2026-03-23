'use client'

import { useState } from 'react'
import SearchForm from '@/components/SearchForm'
import ResultCard from '@/components/ResultCard'
import type { SearchResult } from '@/lib/types'

export default function Home() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const [apiErrors, setApiErrors] = useState<string[]>([])

  async function handleSearch(params: {
    game: string
    keywords: string
    region: string
    platforms: string[]
    dateFrom: string
    dateTo: string
  }) {
    setLoading(true)
    setSearched(false)
    setResults([])
    setExportMsg('')
    setApiErrors([])
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

  async function handleExport(sheetId: string) {
    setExportMsg('匯出中...')
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, sheetId }),
      })
      const data = await res.json()
      if (data.ok) setExportMsg('✓ 已匯出至 Google Sheets')
      else setExportMsg('匯出失敗：' + data.error)
    } catch {
      setExportMsg('匯出失敗')
    }
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
          <div className="flex items-center justify-between mb-4">
            <p className="text-slate-300 text-sm">找到 <span className="text-white font-bold">{results.length}</span> 筆疑似合作內容</p>
            {results.length > 0 && (
              <ExportPanel onExport={handleExport} msg={exportMsg} />
            )}
          </div>

          {apiErrors.length > 0 && (
            <div className="mb-4 space-y-1">
              {apiErrors.map((e, i) => (
                <p key={i} className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{e}</p>
              ))}
            </div>
          )}

          {results.length === 0 ? (
            <p className="text-slate-500 text-center mt-10">沒有找到符合條件的內容</p>
          ) : (
            <div className="space-y-4">
              {results.map((r, i) => <ResultCard key={i} result={r} />)}
            </div>
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
        className="bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 w-64"
        placeholder="Google Sheet ID（選填）"
        value={sheetId}
        onChange={e => setSheetId(e.target.value)}
      />
      <button
        onClick={() => onExport(sheetId)}
        className="bg-green-700 hover:bg-green-600 text-white text-sm px-4 py-1.5 rounded"
      >
        匯出 Sheets
      </button>
      {msg && <span className="text-slate-400 text-xs">{msg}</span>}
    </div>
  )
}
