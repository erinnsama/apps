import { google } from 'googleapis'
import { scoreContent } from './scoring'
import type { SearchResult, SearchParams } from './types'
import fs from 'fs'

// Filter results by title script to match region's expected language
function isRelevantForRegion(title: string, region: string): boolean {
  const hasChinese = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/.test(title)
  const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(title)
  const hasKorean = /[\uac00-\ud7af]/.test(title)
  const hasThai = /[\u0e00-\u0e7f]/.test(title)
  const hasVietnamese = /[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắặẹẻẽếềệỉịọỏốồổỗộớờởỡợụủứừựỷỹ]/i.test(title)

  switch (region) {
    case 'TW': return hasChinese
    case 'JP': return hasJapanese
    case 'KR': return hasKorean
    case 'TH': return hasThai
    case 'VN': return hasVietnamese || (!hasChinese && !hasJapanese && !hasKorean && !hasThai)
    case 'US':
    case 'PH': return !hasChinese && !hasJapanese && !hasKorean && !hasThai
    default: return true
  }
}

// Parse ISO 8601 duration → total seconds
function parseDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0')
}

const REGION_LANGUAGE: Record<string, string> = {
  TW: 'zh-TW',
  JP: 'ja',
  KR: 'ko',
  US: 'en',
  PH: 'en',
  VN: 'vi',
  TH: 'th',
}

function getAuth() {
  // 優先使用 JSON 字串環境變數（Vercel 部署用）
  // 若無則退回讀取本機檔案路徑（本地開發用）
  let credentials: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  } else {
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH
    if (!keyPath) throw new Error('請設定 GOOGLE_SERVICE_ACCOUNT_JSON 或 GOOGLE_SERVICE_ACCOUNT_PATH')
    credentials = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))
  }
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
    relevanceLanguage: REGION_LANGUAGE[params.region] || 'zh-TW',
    maxResults: 50,
    order: params.order || 'relevance',
  }
  if (params.dateFrom) searchParams.publishedAfter = new Date(params.dateFrom).toISOString()
  if (params.dateTo) {
    const d = new Date(params.dateTo)
    d.setHours(23, 59, 59)
    searchParams.publishedBefore = d.toISOString()
  }

  // 分頁抓取，最多 3 頁（150 筆），避免超出 API 配額
  const MAX_PAGES = 2
  const allItems: any[] = []
  let pageToken: string | undefined = undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const pageParams: any = pageToken ? { ...searchParams, pageToken } : { ...searchParams }
    const searchRes: any = await youtube.search.list(pageParams)
    const pageItems = searchRes.data.items || []
    allItems.push(...pageItems)
    if (!searchRes.data.nextPageToken || pageItems.length < 50) break
    pageToken = searchRes.data.nextPageToken
  }

  const items = allItems

  // 取得影片統計數據 + 說明（分批，每次最多 50 筆）
  const allVideoIds: string[] = items.map((i: any) => i.id?.videoId).filter(Boolean)
  let statsMap: Record<string, any> = {}
  let channelIds: string[] = []

  for (let i = 0; i < allVideoIds.length; i += 50) {
    const batchIds = allVideoIds.slice(i, i + 50)
    const statsRes = await youtube.videos.list({
      part: ['statistics', 'snippet', 'contentDetails'],
      id: batchIds,
    })
    for (const v of statsRes.data.items || []) {
      const durationSec = parseDurationSeconds(v.contentDetails?.duration || '')
      statsMap[v.id!] = {
        stats: v.statistics,
        desc: v.snippet?.description || '',
        channelId: v.snippet?.channelId || '',
        thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || '',
        isShort: durationSec > 0 && durationSec <= 60,
      }
      if (v.snippet?.channelId) channelIds.push(v.snippet.channelId)
    }
  }

  // 取得頻道訂閱數
  const subscriberMap: Record<string, number> = {}
  const uniqueChannelIds = Array.from(new Set(channelIds))
  if (uniqueChannelIds.length > 0) {
    // YouTube API allows max 50 per request
    for (let i = 0; i < uniqueChannelIds.length; i += 50) {
      const batch = uniqueChannelIds.slice(i, i + 50)
      const chanRes = await youtube.channels.list({
        part: ['statistics'],
        id: batch,
      })
      for (const ch of chanRes.data.items || []) {
        subscriberMap[ch.id!] = Number(ch.statistics?.subscriberCount) || 0
      }
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
    const channelId = extra?.channelId || ''
    const thumbnailUrl = extra?.thumbnail || snippet?.thumbnails?.medium?.url || ''
    const viewCount = Number(stats.viewCount) || 0
    const isShort = extra?.isShort === true

    // 最低觀看數過濾
    if (params.minViews && viewCount < params.minViews) continue

    // 依地區語言過濾標題
    if (!isRelevantForRegion(snippet?.title || '', params.region)) continue

    // 遊戲名稱相關性過濾：標題或說明至少要出現遊戲名稱
    const gameNameLower = params.game.toLowerCase()
    const titleLower = (snippet?.title || '').toLowerCase()
    const descLower = description.toLowerCase()
    if (!titleLower.includes(gameNameLower) && !descLower.includes(gameNameLower)) continue

    const { score, signals } = scoreContent(snippet?.title || '', description, params.game)

    results.push({
      platform: 'youtube',
      title: snippet?.title || '',
      url: isShort ? `https://www.youtube.com/shorts/${vid}` : `https://www.youtube.com/watch?v=${vid}`,
      channelName: snippet?.channelTitle || '',
      region: params.region,
      publishedAt: snippet?.publishedAt?.slice(0, 10) || '',
      score,
      signals,
      description,
      thumbnailUrl,
      viewCount: viewCount || undefined,
      likeCount: Number(stats.likeCount) || undefined,
      commentCount: Number(stats.commentCount) || undefined,
      subscriberCount: subscriberMap[channelId] || undefined,
      channelId: channelId || undefined,
      isShort,
    })
  }

  return results.sort((a, b) => b.score - a.score)
}
