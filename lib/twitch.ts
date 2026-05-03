import { scoreContent } from './scoring'
import type { SearchResult, SearchParams } from './types'

let cachedToken: string | null = null
let tokenExpiry = 0

async function getAppToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET 未設定')

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (!data.access_token) throw new Error('Twitch token 取得失敗')

  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken!
}

async function twitchFetch(path: string, token: string): Promise<any> {
  const clientId = process.env.TWITCH_CLIENT_ID!
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      'Client-Id': clientId,
      'Authorization': `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || `Twitch API 錯誤 ${res.status}`)
  }
  return res.json()
}

// Twitch language code → region mapping
const REGION_LANG: Record<string, string[]> = {
  TW: ['zh'],
  JP: ['ja'],
  KR: ['ko'],
  TH: ['th'],
  VN: ['vi'],
  US: ['en'],
  PH: ['en', 'tl'],
}

function isLangMatch(clipLang: string, region: string): boolean {
  if (!clipLang) return true // 沒有語言標記則不過濾
  const allowed = REGION_LANG[region]
  if (!allowed) return true
  return allowed.includes(clipLang.toLowerCase())
}

export async function searchTwitch(params: SearchParams): Promise<SearchResult[]> {
  const token = await getAppToken()
  const results: SearchResult[] = []

  // 查遊戲 ID：優先用 twitchGameName（使用者手動指定），否則用 game
  let gameId: string | undefined
  const lookupName = params.twitchGameName?.trim() || params.game

  const exactData = await twitchFetch(
    `/games?name=${encodeURIComponent(lookupName)}`,
    token
  )
  if (exactData.data?.[0]?.id) {
    gameId = exactData.data[0].id
  } else {
    // 精確名稱找不到時，用 search/categories 模糊比對（取前 5 筆，選第一筆）
    try {
      const catData = await twitchFetch(
        `/search/categories?query=${encodeURIComponent(lookupName)}&first=5`,
        token
      )
      if (catData.data?.[0]) {
        gameId = catData.data[0].id
      }
    } catch { /* ignore */ }
  }

  if (gameId) {
    // Clips
    let clipsPath = `/clips?game_id=${gameId}&first=50`
    if (params.dateFrom) clipsPath += `&started_at=${new Date(params.dateFrom).toISOString()}`

    const clipsData = await twitchFetch(clipsPath, token)
    for (const clip of clipsData.data || []) {
      if (params.dateTo) {
        const toDate = new Date(params.dateTo)
        toDate.setHours(23, 59, 59)
        if (new Date(clip.created_at) > toDate) continue
      }
      if (!isLangMatch(clip.language || '', params.region)) continue

      const { score, signals } = scoreContent(clip.title || '', clip.title || '', params.game)
      results.push({
        platform: 'twitch',
        title: `[Clip] ${clip.title || ''}`,
        url: clip.url,
        channelName: clip.broadcaster_name,
        region: params.region,
        publishedAt: clip.created_at?.slice(0, 10) || '',
        score,
        signals,
        viewCount: clip.view_count,
        thumbnailUrl: clip.thumbnail_url,
        description: clip.title || '',
      })
    }

    // VODs（錄影）— after 是 pagination cursor 不是日期，日期用 client 端過濾
    try {
      const vodsData = await twitchFetch(
        `/videos?game_id=${gameId}&type=archive&first=30`,
        token
      )
      for (const vod of vodsData.data || []) {
        if (params.dateFrom && new Date(vod.created_at) < new Date(params.dateFrom)) continue
        if (params.dateTo) {
          const toDate = new Date(params.dateTo)
          toDate.setHours(23, 59, 59)
          if (new Date(vod.created_at) > toDate) continue
        }
        if (!isLangMatch(vod.language || '', params.region)) continue

        const body = `${vod.title || ''} ${vod.description || ''}`
        const { score, signals } = scoreContent(vod.title || '', body, params.game)
        const thumb = vod.thumbnail_url
          ? vod.thumbnail_url.replace('%{width}', '320').replace('%{height}', '180')
          : undefined

        results.push({
          platform: 'twitch',
          title: `[VOD] ${vod.title || ''}`,
          url: vod.url,
          channelName: vod.user_name,
          region: params.region,
          publishedAt: vod.created_at?.slice(0, 10) || '',
          score,
          signals,
          viewCount: vod.view_count,
          thumbnailUrl: thumb,
          description: vod.description || '',
        })
      }
    } catch { /* ignore */ }
  } else {
    // 找不到遊戲 ID 時，搜頻道名稱，再抓各頻道的 VOD
    try {
      const searchData = await twitchFetch(
        `/search/channels?query=${encodeURIComponent(lookupName)}&first=15`,
        token
      )
      const channels = (searchData.data || []).filter((ch: any) =>
        isLangMatch(ch.broadcaster_language || '', params.region)
      )

      // 對每個頻道撈最近 VOD（最多取 10 個頻道，每台 10 部）
      const vodTasks = channels.slice(0, 10).map((ch: any) =>
        twitchFetch(`/videos?user_id=${ch.id}&type=archive&first=10`, token)
          .then((res: any) => ({ ch, vods: res.data || [] }))
          .catch(() => ({ ch, vods: [] as any[] }))
      )
      const vodResults = await Promise.all(vodTasks)

      for (const { ch, vods } of vodResults) {
        for (const vod of vods) {
          if (params.dateFrom && new Date(vod.created_at) < new Date(params.dateFrom)) continue
          if (params.dateTo) {
            const toDate = new Date(params.dateTo)
            toDate.setHours(23, 59, 59)
            if (new Date(vod.created_at) > toDate) continue
          }
          const body = `${vod.title || ''} ${vod.description || ''}`
          const { score, signals } = scoreContent(vod.title || '', body, params.game)
          const thumb = vod.thumbnail_url
            ? vod.thumbnail_url.replace('%{width}', '320').replace('%{height}', '180')
            : ch.thumbnail_url
          results.push({
            platform: 'twitch',
            title: `[VOD] ${vod.title || ''}`,
            url: vod.url,
            channelName: ch.display_name,
            region: params.region,
            publishedAt: vod.created_at?.slice(0, 10) || '',
            score,
            signals,
            viewCount: vod.view_count,
            thumbnailUrl: thumb,
            description: vod.description || '',
          })
        }
      }
    } catch { /* ignore */ }
  }

  return results.sort((a, b) => b.score - a.score)
}
