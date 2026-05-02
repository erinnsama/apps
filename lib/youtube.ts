import { google } from 'googleapis'
import { scoreContent } from './scoring'
import type { SearchResult, SearchParams } from './types'
import fs from 'fs'

function scriptRatio(title: string, pattern: RegExp): number {
  if (!title.length) return 0
  const matches = title.match(pattern) || []
  return matches.length / title.length
}

// 地區嚴格比對：結合影片語言、頻道國家、標題字元
function isRegionMatch(title: string, region: string, lang: string, country: string): boolean {
  const CJK = /[一-鿿㐀-䶿豈-﫿]/g
  const JP  = /[぀-ゟ゠-ヿ]/g
  const KR  = /[가-힯]/g
  const TH  = /[฀-๿]/g

  switch (region) {
    case 'TW': {
      if (country === 'TW') return true
      if (lang === 'zh-TW') return true
      // 語言明確非中文 → 擋掉
      if (lang && lang !== 'zh-TW' && lang !== 'zh') return false
      // 頻道國家明確設定且非 TW → 擋掉（排除美國、日本等英文台）
      if (country && country !== 'TW') return false
      // 語言/國家都不明：標題有 CJK 且無日文/韓文才過
      const hasCJK = scriptRatio(title, CJK) >= 0.15
      const hasJP  = scriptRatio(title, JP) > 0
      const hasKR  = scriptRatio(title, KR) > 0
      return hasCJK && !hasJP && !hasKR
    }
    case 'JP':
      if (country === 'JP') return true
      if (lang && !lang.startsWith('ja')) return false
      return scriptRatio(title, JP) > 0
    case 'KR':
      if (country === 'KR') return true
      if (lang && !lang.startsWith('ko')) return false
      return scriptRatio(title, KR) > 0
    case 'TH':
      if (country === 'TH') return true
      if (lang && !lang.startsWith('th')) return false
      return scriptRatio(title, TH) > 0
    case 'VN': {
      if (country === 'VN') return true
      if (lang && !lang.startsWith('vi')) return false
      const hasVietnamese = /[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắặẹẻẽếềệỉịọỏốồổỗộớờởỡợụủứừựỷỹ]/i.test(title)
      const hasAsian = (scriptRatio(title, CJK) + scriptRatio(title, JP) + scriptRatio(title, KR) + scriptRatio(title, TH)) >= 0.1
      return hasVietnamese || !hasAsian
    }
    case 'US':
    case 'PH':
      if (country === region) return true
      if (lang && !lang.startsWith('en')) return false
      return (scriptRatio(title, CJK) + scriptRatio(title, JP) + scriptRatio(title, KR) + scriptRatio(title, TH)) < 0.2
    default:
      return true
  }
}

function isGameRelevant(title: string, description: string, gameName: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s.\-_\/\\·•]/g, '')
  const normGame = normalize(gameName)
  const normTitle = normalize(title)
  const normDesc = normalize(description)

  if (normTitle.includes(normGame) || normDesc.includes(normGame)) return true

  const words = gameName.split(/[\s.\-_\/\\]/).filter(w => w.length >= 2)
  for (const word of words) {
    const normWord = normalize(word)
    if (normTitle.includes(normWord) || normDesc.includes(normWord)) return true
  }

  if (/[一-鿿]/.test(gameName)) {
    for (let i = 0; i <= gameName.length - 2; i++) {
      const chunk = gameName.slice(i, i + 2)
      if (title.includes(chunk) || description.includes(chunk)) return true
    }
  }

  return false
}

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

function isQuotaError(e: any): boolean {
  const msg = (e.message || '').toLowerCase()
  return msg.includes('quota') || msg.includes('quotaexceeded') || e.code === 403 || e.status === 403
}

async function searchYouTubeWithKey(apiKey: string, params: SearchParams): Promise<SearchResult[]> {
  const youtube = google.youtube({ version: 'v3', auth: apiKey })
  return _searchWithYoutube(youtube, params)
}

async function _searchWithYoutube(youtube: any, params: SearchParams): Promise<SearchResult[]> {
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

  const allVideoIds: string[] = items.map((i: any) => i.id?.videoId).filter(Boolean)
  const statsMap: Record<string, any> = {}
  const channelIds: string[] = []

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
        defaultLanguage: v.snippet?.defaultLanguage || v.snippet?.defaultAudioLanguage || '',
      }
      if (v.snippet?.channelId) channelIds.push(v.snippet.channelId)
    }
  }

  const subscriberMap: Record<string, number> = {}
  const channelCountryMap: Record<string, string> = {}
  const uniqueChannelIds = Array.from(new Set(channelIds))
  if (uniqueChannelIds.length > 0) {
    for (let i = 0; i < uniqueChannelIds.length; i += 50) {
      const batch = uniqueChannelIds.slice(i, i + 50)
      const chanRes = await youtube.channels.list({
        part: ['statistics', 'snippet'],
        id: batch,
      })
      for (const ch of chanRes.data.items || []) {
        subscriberMap[ch.id!] = Number(ch.statistics?.subscriberCount) || 0
        if (ch.snippet?.country) {
          channelCountryMap[ch.id!] = ch.snippet.country.toUpperCase()
        }
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
    const defaultLanguage: string = extra?.defaultLanguage || ''
    const channelCountry: string = channelCountryMap[channelId] || ''

    if (params.minViews && viewCount < params.minViews) continue

    if (!isRegionMatch(snippet?.title || '', params.region, defaultLanguage, channelCountry)) continue

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

export async function searchYouTube(params: SearchParams): Promise<SearchResult[]> {
  const key2 = process.env.YOUTUBE_API_KEY_2

  try {
    const auth = getAuth()
    const youtube = google.youtube({ version: 'v3', auth })
    return await _searchWithYoutube(youtube, params)
  } catch (e: any) {
    if (isQuotaError(e) && key2) {
      return await searchYouTubeWithKey(key2, params)
    }
    throw e
  }
}
