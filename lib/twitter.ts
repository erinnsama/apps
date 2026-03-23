import { scoreContent } from './scoring'
import type { SearchResult, SearchParams } from './types'

const REGION_LANG: Record<string, string> = {
  TW: 'zh', JP: 'ja', KR: 'ko', US: 'en',
  PH: 'en', VN: 'vi', TH: 'th',
}

export async function searchTwitter(params: SearchParams): Promise<SearchResult[]> {
  const token = process.env.TWITTER_BEARER_TOKEN
  if (!token) throw new Error('TWITTER_BEARER_TOKEN 未設定')

  const lang = REGION_LANG[params.region] || 'en'
  const query = [params.game, params.keywords].filter(Boolean).join(' OR ')
  const fullQuery = `(${query}) lang:${lang} -is:retweet`

  const urlParams = new URLSearchParams({
    query: fullQuery,
    max_results: '30',
    'tweet.fields': 'created_at,public_metrics,author_id',
    'user.fields': 'name,username',
    expansions: 'author_id',
  })

  if (params.dateFrom) urlParams.set('start_time', new Date(params.dateFrom).toISOString())
  if (params.dateTo) {
    const d = new Date(params.dateTo)
    d.setHours(23, 59, 59)
    urlParams.set('end_time', d.toISOString())
  }

  const res = await fetch(
    `https://api.twitter.com/2/tweets/search/recent?${urlParams}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.detail || 'Twitter API 錯誤')
  }

  const data = await res.json()
  const tweets = data.data || []
  const users: Record<string, any> = {}
  for (const u of data.includes?.users || []) {
    users[u.id] = u
  }

  const results: SearchResult[] = []

  for (const tweet of tweets) {
    const { score, signals } = scoreContent(tweet.text, tweet.text, params.game)
    const user = users[tweet.author_id] || {}
    const metrics = tweet.public_metrics || {}

    results.push({
      platform: 'twitter',
      title: tweet.text.slice(0, 120) + (tweet.text.length > 120 ? '...' : ''),
      url: `https://twitter.com/i/web/status/${tweet.id}`,
      channelName: user.name ? `@${user.username} (${user.name})` : tweet.author_id,
      region: params.region,
      publishedAt: tweet.created_at?.slice(0, 10) || '',
      score,
      signals,
      likeCount: metrics.like_count,
      retweetCount: metrics.retweet_count,
    })
  }

  return results.sort((a, b) => b.score - a.score)
}
