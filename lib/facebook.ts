import { scoreContent } from './scoring'
import type { SearchResult, SearchParams } from './types'

async function getAppAccessToken(): Promise<string> {
  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) throw new Error('FACEBOOK_APP_ID 或 FACEBOOK_APP_SECRET 未設定')

  const res = await fetch(
    `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`
  )
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error?.message || 'Facebook 取得 access token 失敗')
  return data.access_token
}

export async function searchFacebook(params: SearchParams): Promise<SearchResult[]> {
  const token = await getAppAccessToken()

  const query = [params.game, params.keywords].filter(Boolean).join(' ')

  // Search public pages matching the game/keyword
  const pageRes = await fetch(
    `https://graph.facebook.com/v19.0/pages/search?q=${encodeURIComponent(query)}&fields=id,name,fan_count&limit=10&access_token=${token}`
  )
  const pageData = await pageRes.json()

  if (!pageRes.ok || pageData.error) {
    throw new Error(pageData.error?.message || 'Facebook Pages 搜尋失敗')
  }

  const pages: any[] = pageData.data || []
  const results: SearchResult[] = []

  for (const page of pages) {
    // Fetch recent posts from each page
    const postsRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}/posts?fields=id,message,story,created_time,full_picture,permalink_url&limit=10&access_token=${token}`
    )
    const postsData = await postsRes.json()
    const posts: any[] = postsData.data || []

    for (const post of posts) {
      const text = post.message || post.story || ''
      if (!text) continue

      // Filter by date range
      if (params.dateFrom) {
        const postDate = new Date(post.created_time)
        if (postDate < new Date(params.dateFrom)) continue
      }
      if (params.dateTo) {
        const postDate = new Date(post.created_time)
        const toDate = new Date(params.dateTo)
        toDate.setHours(23, 59, 59)
        if (postDate > toDate) continue
      }

      const { score, signals } = scoreContent(text, text, params.game)

      results.push({
        platform: 'facebook',
        title: text.slice(0, 120) + (text.length > 120 ? '...' : ''),
        url: post.permalink_url || `https://www.facebook.com/${page.id}/posts/${post.id.split('_')[1]}`,
        channelName: page.name,
        region: params.region,
        publishedAt: post.created_time?.slice(0, 10) || '',
        score,
        signals,
        description: text,
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
