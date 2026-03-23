import type { SearchResult } from '@/lib/types'

const STAR_COLORS = ['', 'text-yellow-600', 'text-yellow-400', 'text-yellow-300']
const STAR_LABELS = ['', '低度疑似', '中度疑似', '高度疑似合作']
const PLATFORM_BADGE: Record<string, string> = {
  youtube: 'bg-red-900 text-red-300',
  twitter: 'bg-sky-900 text-sky-300',
  facebook: 'bg-blue-900 text-blue-300',
}
const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  twitter: 'Twitter/X',
  facebook: 'Facebook',
}

export default function ResultCard({ result }: { result: SearchResult }) {
  const stars = result.score
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-500 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_BADGE[result.platform] || 'bg-slate-700 text-slate-300'}`}>
              {result.platform === 'youtube' ? 'YouTube' : 'Twitter/X'}
            </span>
            <span className="text-xs text-slate-400">{result.region}</span>
            <span className="text-xs text-slate-500">{result.publishedAt}</span>
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-medium hover:text-blue-400 transition-colors line-clamp-2"
          >
            {result.title}
          </a>
          <p className="text-slate-400 text-sm mt-1">{result.channelName}</p>
        </div>

        <div className="text-right shrink-0">
          <div className={`text-lg font-bold ${STAR_COLORS[stars]}`}>
            {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
          </div>
          <div className={`text-xs mt-0.5 ${STAR_COLORS[stars]}`}>{STAR_LABELS[stars]}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
        {result.viewCount !== undefined && (
          <span>觀看 <span className="text-slate-200">{fmtNum(result.viewCount)}</span></span>
        )}
        {result.likeCount !== undefined && (
          <span>按讚 <span className="text-slate-200">{fmtNum(result.likeCount)}</span></span>
        )}
        {result.commentCount !== undefined && (
          <span>留言 <span className="text-slate-200">{fmtNum(result.commentCount)}</span></span>
        )}
        {result.retweetCount !== undefined && (
          <span>轉推 <span className="text-slate-200">{fmtNum(result.retweetCount)}</span></span>
        )}
      </div>

      {result.signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.signals.map((s, i) => (
            <span key={i} className="bg-amber-900/40 text-amber-300 text-xs px-2 py-0.5 rounded-full border border-amber-800/50">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
