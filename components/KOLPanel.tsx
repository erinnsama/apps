'use client'

import { useMemo, useState } from 'react'
import type { SearchResult } from '@/lib/types'

interface KOLSummary {
  channelName: string
  channelId?: string
  subscriberCount?: number
  videoCount: number
  totalViews: number
  topScore: 1 | 2 | 3
  hasCollab: boolean
  allSignals: string[]
  regions: string[]
  videos: SearchResult[]
}

type SortKey = 'subscribers' | 'videos' | 'views' | 'score'

function fmt(n?: number) {
  if (!n) return '-'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

export default function KOLPanel({ results }: { results: SearchResult[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('subscribers')
  const [collabOnly, setCollabOnly] = useState(false)
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null)

  const kols = useMemo<KOLSummary[]>(() => {
    const map = new Map<string, KOLSummary>()

    for (const r of results) {
      const key = r.channelId || r.channelName
      if (!map.has(key)) {
        map.set(key, {
          channelName: r.channelName,
          channelId: r.channelId,
          subscriberCount: r.subscriberCount,
          videoCount: 0,
          totalViews: 0,
          topScore: 1,
          hasCollab: false,
          allSignals: [],
          regions: [],
          videos: [],
        })
      }
      const kol = map.get(key)!
      kol.videoCount++
      kol.totalViews += r.viewCount || 0
      if (r.score > kol.topScore) kol.topScore = r.score as 1 | 2 | 3
      if (r.score === 3) kol.hasCollab = true
      if (r.subscriberCount && !kol.subscriberCount) kol.subscriberCount = r.subscriberCount
      for (const s of r.signals) {
        if (!kol.allSignals.includes(s)) kol.allSignals.push(s)
      }
      if (!kol.regions.includes(r.region)) kol.regions.push(r.region)
      kol.videos.push(r)
    }

    return Array.from(map.values())
  }, [results])

  const sorted = useMemo(() => {
    let list = collabOnly ? kols.filter(k => k.hasCollab) : kols
    return [...list].sort((a, b) => {
      if (sortKey === 'subscribers') return (b.subscriberCount || 0) - (a.subscriberCount || 0)
      if (sortKey === 'videos') return b.videoCount - a.videoCount
      if (sortKey === 'views') return b.totalViews - a.totalViews
      if (sortKey === 'score') return b.topScore - a.topScore
      return 0
    })
  }, [kols, sortKey, collabOnly])

  const collabCount = kols.filter(k => k.hasCollab).length

  const SCORE_STYLE: Record<number, string> = {
    3: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    2: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    1: 'bg-slate-700/50 text-slate-400 border-slate-600',
  }
  const SCORE_LABEL: Record<number, string> = { 3: '★★★', 2: '★★', 1: '★' }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="text-slate-300 text-sm">
          共 <span className="text-white font-bold">{kols.length}</span> 個頻道
          {collabCount > 0 && (
            <span className="text-orange-400 ml-2">★★★ 工商 {collabCount} 個</span>
          )}
        </p>

        <button
          onClick={() => setCollabOnly(v => !v)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${collabOnly ? 'bg-orange-700/50 border-orange-500 text-orange-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
        >
          僅顯示有工商
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-slate-500 text-xs">排序：</span>
          {([
            { k: 'subscribers', label: '訂閱數' },
            { k: 'videos', label: '影片數' },
            { k: 'views', label: '總觀看' },
            { k: 'score', label: '評分' },
          ] as { k: SortKey; label: string }[]).map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${sortKey === k ? 'bg-slate-600 border-slate-400 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KOL List */}
      <div className="space-y-2">
        {sorted.map(kol => {
          const key = kol.channelId || kol.channelName
          const isExpanded = expandedChannel === key
          const channelUrl = kol.channelId
            ? `https://www.youtube.com/channel/${kol.channelId}`
            : undefined

          return (
            <div key={key} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              {/* Channel row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Score badge */}
                <span className={`text-xs px-2 py-0.5 rounded border font-medium shrink-0 ${SCORE_STYLE[kol.topScore]}`}>
                  {SCORE_LABEL[kol.topScore]}
                </span>

                {/* Channel name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {channelUrl ? (
                      <a
                        href={channelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white font-medium text-sm hover:text-blue-400 transition-colors truncate"
                      >
                        {kol.channelName}
                      </a>
                    ) : (
                      <span className="text-white font-medium text-sm truncate">{kol.channelName}</span>
                    )}
                    {kol.hasCollab && (
                      <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/40 px-1.5 py-0.5 rounded shrink-0">
                        工商
                      </span>
                    )}
                    <div className="flex gap-1">
                      {kol.regions.map(r => (
                        <span key={r} className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">{r}</span>
                      ))}
                    </div>
                  </div>
                  {kol.allSignals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {kol.allSignals.slice(0, 5).map(s => (
                        <span key={s} className="text-xs bg-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                      {kol.allSignals.length > 5 && (
                        <span className="text-xs text-slate-500">+{kol.allSignals.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
                  <div className="text-center">
                    <div className="text-white font-medium">{fmt(kol.subscriberCount)}</div>
                    <div>訂閱</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-medium">{kol.videoCount}</div>
                    <div>影片</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-medium">{fmt(kol.totalViews)}</div>
                    <div>總觀看</div>
                  </div>
                  <button
                    onClick={() => setExpandedChannel(isExpanded ? null : key)}
                    className="text-slate-400 hover:text-white transition-colors text-base pl-2"
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
              </div>

              {/* Expanded video list */}
              {isExpanded && (
                <div className="border-t border-slate-700 divide-y divide-slate-700/50">
                  {kol.videos
                    .sort((a, b) => b.score - a.score)
                    .map((v, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/30 transition-colors">
                        {v.thumbnailUrl && (
                          <img src={v.thumbnailUrl} alt="" className="w-20 h-11 object-cover rounded shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <a
                            href={v.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-200 text-sm hover:text-blue-400 transition-colors line-clamp-2"
                          >
                            {v.title}
                          </a>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>{v.publishedAt}</span>
                            {v.isShort && <span className="bg-rose-900/60 text-rose-300 border border-rose-800/50 px-1.5 py-0.5 rounded">Short</span>}
                            {v.viewCount && <span>👁 {fmt(v.viewCount)}</span>}
                            {v.signals.length > 0 && (
                              <span className="text-slate-600">{v.signals.slice(0, 3).join('・')}</span>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded border shrink-0 ${SCORE_STYLE[v.score]}`}>
                          {SCORE_LABEL[v.score]}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {sorted.length === 0 && (
        <p className="text-slate-500 text-center mt-10">沒有符合條件的頻道</p>
      )}
    </div>
  )
}
