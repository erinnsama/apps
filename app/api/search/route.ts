import { NextRequest, NextResponse } from 'next/server'
import { searchYouTube } from '@/lib/youtube'
import { searchTwitter } from '@/lib/twitter'
import { searchFacebook } from '@/lib/facebook'
import type { SearchParams } from '@/lib/types'

export async function POST(req: NextRequest) {
  const params: SearchParams = await req.json()

  const errors: string[] = []
  const tasks: Promise<any[]>[] = []

  if (params.platforms.includes('youtube')) {
    tasks.push(searchYouTube(params).catch(e => {
      errors.push('YouTube: ' + e.message)
      return []
    }))
  }

  if (params.platforms.includes('twitter')) {
    tasks.push(searchTwitter(params).catch(e => {
      errors.push('Twitter: ' + e.message)
      return []
    }))
  }

  if (params.platforms.includes('facebook')) {
    tasks.push(searchFacebook(params).catch(e => {
      errors.push('Facebook: ' + e.message)
      return []
    }))
  }

  const arrays = await Promise.all(tasks)
  const results = arrays.flat().sort((a, b) => b.score - a.score)

  return NextResponse.json({ results, errors })
}
