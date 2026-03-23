// 疑似合作偵測訊號清單
const HIGH_SIGNALS: Record<string, string> = {
  '#ad': '#AD 標示',
  '#sponsored': '#Sponsored 標示',
  '#贊助': '#贊助 標示',
  '#合作': '#合作 標示',
  '#pr': '#PR 標示',
  '業配': '業配字詞',
  'sponsored by': 'Sponsored by 字詞',
  'in partnership with': 'Partnership 字詞',
  'presented by': 'Presented by 字詞',
  '感謝.*贊助': '贊助感謝語',
  'paid promotion': 'Paid Promotion 標示',
}

const MEDIUM_SIGNALS: Record<string, string> = {
  'download now': '下載連結',
  '立即下載': '立即下載連結',
  '免費下載': '免費下載連結',
  'play now': 'Play Now 連結',
  '點擊下載': '點擊下載連結',
  'app store': 'App Store 連結',
  'google play': 'Google Play 連結',
  'onelink': 'OneLink 追蹤連結',
  'bit.ly': '短網址連結',
  'linktr.ee': 'Linktree 連結',
  '代言': '代言字詞',
  'ambassador': 'Ambassador 字詞',
  '合作影片': '合作影片字詞',
}

export function scoreContent(
  title: string,
  description: string,
  gameName: string
): { score: 1 | 2 | 3; signals: string[] } {
  const text = (title + ' ' + description).toLowerCase()
  const detectedSignals: string[] = []
  let highCount = 0
  let mediumCount = 0

  for (const [pattern, label] of Object.entries(HIGH_SIGNALS)) {
    const re = new RegExp(pattern, 'i')
    if (re.test(text)) {
      detectedSignals.push(label)
      highCount++
    }
  }

  for (const [pattern, label] of Object.entries(MEDIUM_SIGNALS)) {
    if (text.includes(pattern.toLowerCase())) {
      detectedSignals.push(label)
      mediumCount++
    }
  }

  // 標題含「遊戲名 × 」格式
  const crossPattern = new RegExp(`${gameName}.*[×x]|[×x].*${gameName}`, 'i')
  if (crossPattern.test(title)) {
    detectedSignals.push('聯名命名格式（× 符號）')
    mediumCount++
  }

  let score: 1 | 2 | 3 = 1
  if (highCount >= 2 || (highCount >= 1 && mediumCount >= 2)) score = 3
  else if (highCount >= 1 || mediumCount >= 3) score = 2
  else if (mediumCount >= 1) score = 1

  return { score, signals: [...new Set(detectedSignals)] }
}
