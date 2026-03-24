import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const REGIONS = ['TW', 'JP', 'KR', 'US', 'PH', 'VN', 'TH']

export async function POST(req: NextRequest) {
  const { game } = await req.json()
  if (!game) return NextResponse.json({ error: '未提供遊戲名稱' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY 未設定' }, { status: 500 })

  const client = new Anthropic({ apiKey })

  const prompt = `你是遊戲資料庫專家。請幫我查出以下手機遊戲在各地區的正式名稱。

遊戲名稱：${game}

請以 JSON 格式回傳各地區名稱，格式如下：
{
  "TW": "台灣名稱",
  "JP": "日本名稱（日文）",
  "KR": "韓國名稱（韓文）",
  "US": "英文名稱",
  "PH": "菲律賓英文名稱",
  "VN": "越南名稱",
  "TH": "泰國名稱"
}

規則：
- 只回傳 JSON，不要任何說明文字
- 如果某地區名稱與其他地區相同，直接填相同名稱
- 如果不確定某地區名稱，填入英文名稱
- 不要杜撰名稱，只填確定存在的官方名稱`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('解析失敗')

    const names: Record<string, string> = JSON.parse(jsonMatch[0])
    // Ensure all regions present
    for (const r of REGIONS) {
      if (!names[r]) names[r] = game
    }

    return NextResponse.json({ names })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
