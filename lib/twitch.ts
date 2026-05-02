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

  // 搜尋遊戲 ID
  const gameData = await twitchFetch(
    `/games?name=${encodeURIComponent(params.game)}`,
    token
  )
  const gameId: string | undefined = gameData.data?.[0]?.id

  const results: SearchResult[] = []

  // 搜尋 Clips（最有業配訊號）
  if (gameId) {
    const clipsPath = `/clips?game_id=${gameId}&first=20${params.dateFrom ? `&started_at=${new Date(params.dateFrom).toISOString()}` : ''}`
    const clipsData = await twitchFetch(clipsPath, token)
    const clips = clipsData.data || []

    // 取得 broadcaster 資訊（follower count 需另一支 API）
    const broadcasterIds: string[] = [...new Set(clips.map((c: any) => c.broadcaster_id as string))]
    const followerMap: Record<string, number> = {}
    for (let i = 0; i < broadcasterIds.length; i += 100) {
      const batch = broadcasterIds.slice(i, i + 100)
      const ids = batch.map(id => `broadcaster_id=${id}`).join('&')
      try {
        const followData = await twitchFetch(`/channels/followers?${ids}&first=1`, token)
        for (const ch of followData.data || []) {
          // follower count not directly in this endpoint; use channel info instead
        }
        // Use channel info endpoint instead
        const userIds = batch.map(id => `id=${id}`).join('&')
        const usersData = await twitchFetch(`/users?${userIds}`, token)
        // Twitch doesn't return follower count from /users, skip for now
      } catch { /* ignore */ }
    }

    for (const clip of clips) {
      if (params.dateTo) {
        const clipDate = new Date(clip.created_at)
        const toDate = new Date(params.dateTo)
        toDate.setHours(23, 59, 59)
        if (clipDate > toDate) continue
      }

      const titleText = clip.title || ''
      const { score, signals } = scoreContent(titleText, titleText, params.game)

      results.push({
        platform: 'twitch',
        title: titleText,
        url: clip.url,
        channelName: clip.broadcaster_name,
        region: params.region,
        publishedAt: clip.created_at?.slice(0, 10) || '',
        score,
        signals,
        viewCount: clip.view_count,
        thumbnailUrl: clip.thumbnail_url,
        description: titleText,
      })
    }
  }

  // 關鍵字搜尋 Clips（遊戲找不到 ID 時也能搜）
  if (!gameId) {
    const searchPath = `/clips?query=${encodeURIComponent(params.game)}&first=20`
    try {
      const searchData = await twitchFetch(searchPath, token)
      for (const clip of searchData.data || []) {
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
        })
      }
    } catch { /* ignore */ }
  }

  return results.sort((a, b) => b.score - a.score)
}
