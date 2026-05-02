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

export async function searchTwitch(params: SearchParams): Promise<SearchResult[]> {
  const token = await getAppToken()
  const results: SearchResult[] = []

  // 先查遊戲 ID
  const gameData = await twitchFetch(
    `/games?name=${encodeURIComponent(params.game)}`,
    token
  )
  const gameId: string | undefined = gameData.data?.[0]?.id

  if (gameId) {
    // 用遊戲 ID 搜 Clips
    let clipsPath = `/clips?game_id=${gameId}&first=20`
    if (params.dateFrom) clipsPath += `&started_at=${new Date(params.dateFrom).toISOString()}`

    const clipsData = await twitchFetch(clipsPath, token)
    for (const clip of clipsData.data || []) {
      if (params.dateTo) {
        const toDate = new Date(params.dateTo)
        toDate.setHours(23, 59, 59)
        if (new Date(clip.created_at) > toDate) continue
      }

      const { score, signals } = scoreContent(clip.title || '', clip.title || '', params.game)
      results.push({
        platform: 'twitch',
        title: clip.title || '',
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
  } else {
    // 找不到遊戲 ID 時，用 channel 搜尋作為備援
    try {
      const searchData = await twitchFetch(
        `/search/channels?query=${encodeURIComponent(params.game)}&first=20`,
        token
      )
      for (const ch of searchData.data || []) {
        if (!ch.is_live) continue
        const { score, signals } = scoreContent(ch.display_name || '', ch.title || '', params.game)
        results.push({
          platform: 'twitch',
          title: ch.title || ch.display_name || '',
          url: `https://www.twitch.tv/${ch.broadcaster_login}`,
          channelName: ch.display_name,
          region: params.region,
          publishedAt: ch.started_at?.slice(0, 10) || '',
          score,
          signals,
          thumbnailUrl: ch.thumbnail_url,
        })
      }
    } catch { /* ignore */ }
  }

  return results.sort((a, b) => b.score - a.score)
}
