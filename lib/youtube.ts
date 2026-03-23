import { google } from 'googleapis'
import { scoreContent } from './scoring'
import type { SearchResult, SearchParams } from './types'
import fs from 'fs'

function getAuth() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH
  if (!keyPath) throw new Error('GOOGLE_SERVICE_ACCOUNT_PATH 未設定')
  const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
  })
}

export async function searchYouTube(params: SearchParams): Promise<SearchResult[]> {
  const auth = getAuth()
  const youtube = google.youtube({ version: 'v3', auth })

  const query = [params.game, params.keywords].filter(Boolean).join(' ')

  const searchParams: any = {
    part: ['snippet'],
    q: query,
    type: ['video'],
    regionCode: params.region,
    maxResults: 30,
    order: 'relevance',
  }
  if (params.dateFrom) searchParams.publishedAfter = new Date(params.dateFrom).toISOString()
  if (params.dateTo) {
    const d = new Date(params.dateTo)
    d.setHours(23, 59, 59)
    searchParams.publishedBefore = d.toISOString()
  }

  const searchRes = await youtube.search.list(searchParams)
  const items = searchRes.data.items || []

  // 取得影片統計數據
  const videoIds = items.map((i: any) => i.id?.videoId).filter(Boolean)
  let statsMap: Record<string, any> = {}
  if (videoIds.length > 0) {
    const statsRes = await youtube.videos.list({
      part: ['statistics', 'snippet'],
      id: videoIds,
    })
    for (const v of statsRes.data.items || []) {
      statsMap[v.id!] = { stats: v.statistics, desc: v.snippet?.description || '' }
    }
  }

  const results: SearchResult[] = []

  for (const item of items) {
    const vid = item.id?.videoId
    if (!vid) continue

    const snippet = item.snippet
    const extra = statsMap[vid]
    const description = extra?.desc || ''
    const stats = extra?.stats || {}

    const { score, signals } = scoreContent(snippet.title, description, params.game)

    results.push({
      platform: 'youtube',
      title: snippet.title,
      url: `https://www.youtube.com/watch?v=${vid}`,
      channelName: snippet.channelTitle,
      region: params.region,
      publishedAt: snippet.publishedAt?.slice(0, 10) || '',
      score,
      signals,
      description,
      viewCount: Number(stats.viewCount) || undefined,
      likeCount: Number(stats.likeCount) || undefined,
      commentCount: Number(stats.commentCount) || undefined,
    })
  }

  return results.sort((a, b) => b.score - a.score)
}
