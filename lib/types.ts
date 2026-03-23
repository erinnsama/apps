export interface SearchResult {
  platform: 'youtube' | 'twitter' | 'facebook'
  title: string
  url: string
  channelName: string
  region: string
  publishedAt: string
  score: 1 | 2 | 3          // 1=低 2=中 3=高
  signals: string[]          // 偵測到的合作訊號
  viewCount?: number
  likeCount?: number
  commentCount?: number
  retweetCount?: number
  description?: string
}

export interface SearchParams {
  game: string
  keywords: string
  region: string
  platforms: string[]
  dateFrom: string
  dateTo: string
}
