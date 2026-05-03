import { NextRequest, NextResponse } from 'next/server'

let cachedToken: string | null = null
let tokenExpiry = 0

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  )
  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken!
}

async function tw(path: string, token: string) {
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID!, 'Authorization': `Bearer ${token}` }
  })
  return res.json()
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '點點英雄'
  const token = await getToken()

  const [exactGame, searchCat, searchCh] = await Promise.all([
    tw(`/games?name=${encodeURIComponent(q)}`, token),
    tw(`/search/categories?query=${encodeURIComponent(q)}&first=5`, token),
    tw(`/search/channels?query=${encodeURIComponent(q)}&first=10`, token),
  ])

  // 如果有頻道，也撈第一個的 VOD 標題
  let sampleVods: any[] = []
  if (searchCh.data?.[0]) {
    const v = await tw(`/videos?user_id=${searchCh.data[0].id}&type=archive&first=5`, token)
    sampleVods = (v.data || []).map((x: any) => ({ title: x.title, created_at: x.created_at, url: x.url }))
  }

  return NextResponse.json({
    query: q,
    exactGame: exactGame.data || [],
    searchCategories: searchCat.data || [],
    searchChannels: (searchCh.data || []).map((c: any) => ({
      id: c.id,
      display_name: c.display_name,
      broadcaster_language: c.broadcaster_language,
      is_live: c.is_live,
      title: c.title,
    })),
    sampleVodsFromFirstChannel: sampleVods,
  })
}
