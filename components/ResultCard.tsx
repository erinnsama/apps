import { useState } from 'react'
import type { SearchResult } from '@/lib/types'

const PLATFORM_BADGE: Record<string, string> = {
  youtube: 'bg-red-900/60 text-red-300 border border-red-800/50',
  twitter: 'bg-sky-900/60 text-sky-300 border border-sky-800/50',
  facebook: 'bg-blue-900/60 text-blue-300 border border-blue-800/50',
  instagram: 'bg-pink-900/60 text-pink-300 border border-pink-800/50',
  twitch: 'bg-purple-900/60 text-purple-300 border border-purple-800/50',
}
const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitch: 'Twitch',
}
const SCORE_CONFIG = [
  {},
  { stars: '★☆☆', label: '低度疑似', color: 'text-slate-400', bg: 'bg-slate-700/50 border-slate-600' },
  { stars: '★★☆', label: '中度疑似', color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-700/50' },
  { stars: '★★★', label: '高度疑似', color: 'text-orange-400', bg: 'bg-orange-900/30 border-orange-700/50' },
]

export default function ResultCard({ result }: { result: SearchResult }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SCORE_CONFIG[result.score]

  return (
    <div className={`bg-slate-800 border rounded-xl overflow-hidden hover:border-slate-500 transition-colors ${result.score === 3 ? 'border-orange-800/60' : result.score === 2 ? 'border-yellow-800/40' : 'border-slate-700'}`}>
      <div className="flex gap-0">
        {/* Thumbnail */}
        {result.thumbnailUrl && (
          <a href={result.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <img
              src={result.thumbnailUrl}
              alt=""
              className="w-36 h-full object-cover"
              style={{ minHeight: '100px', maxHeight: '130px' }}
            />
          </a>
        )}

        <div className="flex-1 p-4 min-w-0">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_BADGE[result.platform] || 'bg-slate-700 text-slate-300'}`}>
                  {PLATFORM_LABEL[result.platform] || result.platform}
                </span>
                {result.isShort && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-rose-900/60 text-rose-300 border border-rose-800/50">
                    Short
                  </span>
                )}
                <span className="text-xs text-slate-400">{result.region}</span>
                <span className="text-xs text-slate-500">{result.publishedAt}</span>
              </div>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white font-medium hover:text-blue-400 transition-colors line-clamp-2 block"
              >
                {result.title}
              </a>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-slate-400 text-sm">{result.channelName}</p>
                {result.subscriberCount !== undefined && result.subscriberCount > 0 && (
                  <span className="text-slate-500 text-xs">{fmtNum(result.subscriberCount)} 訂閱</span>
                )}
              </div>
            </div>

            {/* Score badge */}
            <div className={`shrink-0 text-center px-3 py-2 rounded-lg border ${cfg.bg}`}>
              <div className={`text-base font-bold tracking-wider ${cfg.color}`}>{cfg.stars}</div>
              <div className={`text-xs mt-0.5 ${cfg.color}`}>{cfg.label}</div>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-2.5 flex flex-wrap gap-4 text-xs text-slate-400">
            {result.viewCount !== undefined && (
              <span>👁 <span className="text-slate-200">{fmtNum(result.viewCount)}</span></span>
            )}
            {result.likeCount !== undefined && (
              <span>👍 <span className="text-slate-200">{fmtNum(result.likeCount)}</span></span>
            )}
            {result.commentCount !== undefined && (
              <span>💬 <span className="text-slate-200">{fmtNum(result.commentCount)}</span></span>
            )}
            {result.retweetCount !== undefined && (
              <span>🔁 <span className="text-slate-200">{fmtNum(result.retweetCount)}</span></span>
            )}
          </div>

          {/* Signals */}
          {result.signals.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {result.signals.map((s, i) => (
                <span key={i} className="bg-amber-900/40 text-amber-300 text-xs px-2 py-0.5 rounded-full border border-amber-800/50">
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Description toggle */}
          {result.description && result.description.length > 0 && (
            <div className="mt-2.5">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                {expanded ? '▲ 收起說明' : '▼ 展開說明'}
              </button>
              {expanded && (
                <p className="mt-1.5 text-slate-400 text-xs leading-relaxed whitespace-pre-line border-t border-slate-700 pt-2">
                  {result.description.slice(0, 600)}{result.description.length > 600 ? '...' : ''}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
