import { scoreContent } from './scoring'
import type { SearchResult, SearchParams } from './types'

function getToken(): string {
  const token = process.env.FACEBOOK_USER_TOKEN
  if (!token) throw new Error('FACEBOOK_USER_TOKEN 未設定')
  return token
}

async function getIGUserId(token: string): Promise<string> {
  // Get Facebook Pages managed by the user
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`
  )
  const pagesData = await pagesRes.json()
  if (pagesData.error) throw new Error('無法取得 Facebook Pages: ' + pagesData.error.message)

  const pages: any[] = pagesData.data || []
  if (pages.length === 0) throw new Error('此帳號沒有管理任何 Facebook 粉絲專頁，Instagram 搜尋需要連結粉絲專頁的 IG 商業帳號')

  // Find a page with connected Instagram Business Account
  for (const page of pages) {
    const igRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${token}`
    )
    const igData = await igRes.json()
    if (igData.instagram_business_account?.id) {
      return igData.instagram_business_account.id
    }
  }

  throw new Error('找不到連結 Instagram 商業帳號的粉絲專頁。請在 Instagram 設定中將帳號切換為「商業帳號」並連結至 Facebook 粉絲專頁')
}

async function getHashtagId(igUserId: string, hashtag: string, token: string): Promise<string | null> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/ig_hashtag_search?user_id=${igUserId}&q=${encodeURIComponent(hashtag)}&access_token=${token}`
  )
  const data = await res.json()
  if (data.error || !data.data?.[0]?.id) return null
  return data.data[0].id
}

export async function searchInstagram(params: SearchParams): Promise<SearchResult[]> {
  const token = getToken()
  const igUserId = await getIGUserId(token)

  // Build hashtag list from game name + keywords
  const rawKeywords = [params.game, ...(params.keywords?.split(',') || [])].map(k => k.trim()).filter(Boolean)
  // Remove spaces for hashtag (e.g. "原神" → "原神", "Genshin Impact" → "GenshinImpact")
  const hashtags = rawKeywords.map(k => k.replace(/\s+/g, ''))

  const results: SearchResult[] = []
  const seenIds = new Set<string>()

  for (const tag of hashtags.slice(0, 5)) {
    const hashtagId = await getHashtagId(igUserId, tag, token)
    if (!hashtagId) continue

    const mediaRes = await fetch(
      `https://graph.facebook.com/v19.0/${hashtagId}/recent_media?user_id=${igUserId}&fields=id,caption,media_type,permalink,timestamp&limit=20&access_token=${token}`
    )
    const mediaData = await mediaRes.json()
    if (mediaData.error || !mediaData.data) continue

    for (const post of mediaData.data) {
      if (seenIds.has(post.id)) continue
      seenIds.add(post.id)

      const caption = post.caption || ''
      if (!caption) continue

      // Date filter
      if (params.dateFrom) {
        const postDate = new Date(post.timestamp)
        if (postDate < new Date(params.dateFrom)) continue
      }
      if (params.dateTo) {
        const postDate = new Date(post.timestamp)
        const toDate = new Date(params.dateTo)
        toDate.setHours(23, 59, 59)
        if (postDate > toDate) continue
      }

      const { score, signals } = scoreContent(caption, caption, params.game)

      results.push({
        platform: 'instagram',
        title: caption.slice(0, 120) + (caption.length > 120 ? '...' : ''),
        url: post.permalink,
        channelName: `#${tag}`,
        region: params.region,
        publishedAt: post.timestamp?.slice(0, 10) || '',
        score,
        signals,
        description: caption,
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
