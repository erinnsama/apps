import { google } from 'googleapis'
import { scoreContent } from './scoring'
import type { SearchResult, SearchParams } from './types'
import fs from 'fs'

// 計算標題中 CJK/特殊文字的比例
function scriptRatio(title: string, pattern: RegExp): number {
  if (!title.length) return 0
  const matches = title.match(pattern) || []
  return matches.length / title.length
}

// Filter results by title script to match region's expected language
// 使用比例制，允許混合語言標題（例如中文標題夾雜英文遊戲名）
function isRelevantForRegion(title: string, region: string): boolean {
  const CJK = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g
  const JP  = /[\u3040-\u309f\u30a0-\u30ff]/g
  const KR  = /[\uac00-\ud7af]/g
  const TH  = /[\u0e00-\u0e7f]/g
  const hasVietnamese = /[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắặẹẻẽếềệỉịọỏốồổỗộớờởỡợụủứừựỷỹ]/i.test(title)

  switch (region) {
    // 中文地區：至少 15% 中文字元即可（允許大量英文混入）
    case 'TW': return scriptRatio(title, CJK) >= 0.15
    // 日文：至少有日文假名
    case 'JP': return scriptRatio(title, JP) > 0
    // 韓文：至少有韓文
    case 'KR': return scriptRatio(title, KR) > 0
    // 泰文：至少有泰文
    case 'TH': return scriptRatio(title, TH) > 0
    // 越南：有越南文，或沒有其他亞洲文字
    case 'VN': return hasVietnamese || (scriptRatio(title, CJK) + scriptRatio(title, JP) + scriptRatio(title, KR) + scriptRatio(title, TH) < 0.1)
    // US/PH：允許最多 20% CJK（遊戲名可能是中文）
    case 'US':
    case 'PH': return (scriptRatio(title, CJK) + scriptRatio(title, JP) + scriptRatio(title, KR) + scriptRatio(title, TH)) < 0.2
    default: return true
  }
}

// 遊戲名稱正規化比對：移除標點/空格，支援大小寫與部分匹配
function isGameRelevant(title: string, description: string, gameName: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s.\-_\/\\·•]/g, '')
  const normGame = normalize(gameName)
  const normTitle = normalize(title)
  const normDesc = normalize(description)

  // 完整正規化比對
  if (normTitle.includes(normGame) || normDesc.includes(normGame)) return true

  // 拆詞比對：英文以空格/點分割，中文以 2 字元為單位
  const words = gameName.split(/[\s.\-_\/\\]/).filter(w => w.length >= 2)
  for (const word of words) {
    const normWord = normalize(word)
    if (normTitle.includes(normWord) || normDesc.includes(normWord)) return true
  }

  // 中文拆字：每 2 個字元為一組滑動視窗
  if (/[\u4e00-\u9fff]/.test(gameName)) {
    for (let i = 0; i <= gameName.length - 2; i++) {
      const chunk = gameName.slice(i, i + 2)
      if (title.includes(chunk) || description.includes(chunk)) return true
    }
  }

  return false
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

    // 遊戲名稱相關性過濾：支援正規化與部分比對
    if (!isGameRelevant(snippet?.title || '', description, params.game)) continue

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
