export interface SearchResult {
  platform: 'youtube' | 'twitter' | 'facebook' | 'instagram' | 'twitch'
  title: string
  url: string
  channelName: string
  region: string
  publishedAt: string
  score: 1 | 2 | 3
  signals: string[]
  viewCount?: number
  likeCount?: number
  commentCount?: number
  retweetCount?: number
  description?: string
  thumbnailUrl?: string
  subscriberCount?: number
  channelId?: string
  isShort?: boolean
}

export interface SearchParams {
  game: string
  keywords: string
  region: string
  regions?: string[]           // 多地區複選
  regionalNames?: Record<string, string>  // 各地區對應的遊戲名稱
  platforms: string[]
  dateFrom: string
  dateTo: string
  order?: 'relevance' | 'date' | 'viewCount'
  minViews?: number
  twitchGameName?: string   // Twitch 專用遊戲名稱（英文），覆蓋 game 欄位用於 Twitch 查詢
}
