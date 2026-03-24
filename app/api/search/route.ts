import { NextRequest, NextResponse } from 'next/server'
import { searchYouTube } from '@/lib/youtube'
import { searchTwitter } from '@/lib/twitter'
import { searchInstagram } from '@/lib/instagram'
import type { SearchParams } from '@/lib/types'

export async function POST(req: NextRequest) {
  const params: SearchParams = await req.json()

  const errors: string[] = []
  const tasks: Promise<any[]>[] = []

  // 多地區支援：有 regions 陣列時逐地區搜尋，各用該地區的遊戲名稱
  const regionList = params.regions && params.regions.length > 0 ? params.regions : [params.region]

  for (const region of regionList) {
    const regionalGame = params.regionalNames?.[region] || params.game
    const regionParams: SearchParams = { ...params, region, game: regionalGame }

    if (params.platforms.includes('youtube')) {
      tasks.push(searchYouTube(regionParams).catch(e => {
        const msg = e.message || ''
        if (msg.includes('quota') || msg.includes('quotaExceeded') || e.code === 403) {
          errors.push(`⚠️ YouTube API 今日配額已用完，明天 UTC 00:00 自動重置後即可繼續使用`)
        } else {
          errors.push(`YouTube(${region}): ` + msg)
        }
        return []
      }))
    }

    if (params.platforms.includes('twitter')) {
      tasks.push(searchTwitter(regionParams).catch(e => {
        errors.push(`Twitter(${region}): ` + e.message)
        return []
      }))
    }

    if (params.platforms.includes('instagram')) {
      tasks.push(searchInstagram(regionParams).catch(e => {
        errors.push(`Instagram(${region}): ` + e.message)
        return []
      }))
    }
  }

  const arrays = await Promise.all(tasks)
  // 去除重複 URL
  const seen = new Set<string>()
  const results = arrays.flat().filter(r => {
    if (seen.has(r.url)) return false
    seen.add(r.url)
    return true
  }).sort((a, b) => b.score - a.score)

  return NextResponse.json({ results, errors })
}
