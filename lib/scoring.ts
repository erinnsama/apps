// 非遊戲贊助商清單 — 若這些品牌出現在贊助語境中，不計入合作訊號
const NON_GAME_BRANDS = [
  '歐付寶', 'opay', '街口', 'jkopay', '玉山', 'taiwan pay', 'line pay', 'linepay',
  'apple pay', 'google pay', '悠遊付', '一卡通',
  'nordvpn', 'expressvpn', 'surfshark', 'purevpn',
  'booking.com', 'agoda', 'klook', 'kkday',
  'shopee', 'lazada', 'momo購物', 'pchome', '蝦皮',
  '全聯', '7-eleven', '萊爾富', '全家', 'familymart',
]

// ★★★ 高度訊號 — 明確的業配/廣告/贊助聲明，或追蹤導流連結
const HIGH_SIGNALS: Record<string, string> = {
  '#ad': '#AD 標示',
  '#sponsored': '#Sponsored 標示',
  '#advertisement': '#Advertisement 標示',
  '#collaboration': '#Collaboration 標示',
  '#collab': '#Collab 標示',
  '#gifted': '#Gifted 標示',
  '#廣告': '#廣告 標示',
  '#贊助': '#贊助 標示',
  '#合作': '#合作 標示',
  '#pr': '#PR 標示',
  '業配': '業配字詞',
  '業配廣告': '業配廣告字詞',
  '廣告合作': '廣告合作字詞',
  '品牌合作': '品牌合作字詞',
  '官方合作': '官方合作字詞',
  '合作廠商': '合作廠商字詞',
  '贊助商': '贊助商字詞',
  '廠商提供': '廠商提供字詞',
  'sponsored by': 'Sponsored by 字詞',
  'paid promotion': 'Paid Promotion 標示',
  'paid partnership': 'Paid Partnership 標示',
  'in partnership with': 'Partnership 字詞',
  'presented by': 'Presented by 字詞',
  'official collab': 'Official Collab 字詞',
  '感謝.*贊助': '贊助感謝語',
  '感謝.*合作': '合作感謝語',
  '感謝.*提供': '提供感謝語',
  'onelink': 'OneLink 追蹤連結',
  '邀請碼': '邀請碼（工商證據）',
}

// ★★ 中度訊號 — 下載導流、社群連結
const MEDIUM_SIGNALS: Record<string, string> = {
  'download now': '下載連結',
  '立即下載': '立即下載連結',
  '免費下載': '免費下載連結',
  'play now': 'Play Now 連結',
  '點擊下載': '點擊下載連結',
  'app store': 'App Store 連結',
  'google play': 'Google Play 連結',
  'apk': 'APK 下載連結',
  'facebook.com': '遊戲 FB 專頁連結',
  'fb.com': '遊戲 FB 專頁連結',
  'discord.gg': 'Discord 社群連結',
  'discord.com/invite': 'Discord 邀請連結',
  'bit.ly': '短網址連結',
  'linktr.ee': 'Linktree 連結',
  '代言': '代言字詞',
  'ambassador': 'Ambassador 字詞',
  '合作影片': '合作影片字詞',
  '推廣': '推廣字詞',
  '體驗': '體驗活動字詞',
  '試用': '試用字詞',
  '折扣碼': '折扣碼',
  '優惠碼': '優惠碼',
  'promo code': 'Promo Code',
  'referral': '推薦連結',
  '免費獲得': '免費獲取活動',
}

// ★ 低度訊號 — 疑似但不確定（如禮包碼可能為創作者自發）
const LOW_SIGNALS: Record<string, string> = {
  '禮包碼': '禮包碼（可能自發）',
  '禮包': '遊戲禮包（可能自發）',
  'gift code': '禮包碼（可能自發）',
  '活動碼': '活動碼（可能自發）',
  '免費禮包': '免費禮包（可能自發）',
  '試玩': '試玩內容',
  '首玩': '首玩內容',
  '開箱': '開箱內容',
  '新手': '新手引導',
  '評測': '遊戲評測',
  'review': '評測字詞',
  'gameplay': 'Gameplay 影片',
  '攻略': '攻略內容',
}

export function scoreContent(
  title: string,
  description: string,
  gameName: string
): { score: 1 | 2 | 3; signals: string[] } {
  const text = (title + ' ' + description).toLowerCase()
  const titleLower = title.toLowerCase()
  const detectedSignals: string[] = []
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0

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

  for (const [pattern, label] of Object.entries(LOW_SIGNALS)) {
    if (text.includes(pattern.toLowerCase())) {
      detectedSignals.push(label)
      lowCount++
    }
  }

  // 標題含「遊戲名 × KOL」聯名格式
  const crossPattern = new RegExp(`${gameName}.*[×x×]|[×x×].*${gameName}`, 'i')
  if (crossPattern.test(titleLower)) {
    detectedSignals.push('聯名命名格式（× 符號）')
    mediumCount++
  }

  // 標題含「遊戲名 feat. / with / ft.」格式
  const featPattern = new RegExp(`${gameName}.*(feat\\.|with |ft\\.)|(feat\\.|with |ft\\.).*${gameName}`, 'i')
  if (featPattern.test(titleLower)) {
    detectedSignals.push('Feat/With 合作格式')
    mediumCount++
  }

  // 描述含連結且有遊戲名 → 可能是業配導流
  const hasLink = /https?:\/\/|bit\.ly|linktr\.ee|onelink/i.test(description)
  const gameInTitle = new RegExp(gameName, 'i').test(title)
  if (hasLink && gameInTitle && description.length > 50) {
    detectedSignals.push('描述含外部連結')
    mediumCount++
  }

  // 若高度訊號是由非遊戲品牌觸發，扣除（例：歐付寶贊助 ≠ 遊戲業配）
  if (highCount > 0) {
    for (const brand of NON_GAME_BRANDS) {
      if (text.includes(brand.toLowerCase())) {
        highCount = Math.max(0, highCount - 1)
        const idx = detectedSignals.findIndex(s => s.includes('贊助') || s.includes('感謝'))
        if (idx !== -1) detectedSignals.splice(idx, 1)
        break
      }
    }
  }

  // 計算最終評分
  // ★★★：任何一個高度訊號（明確業配聲明 / OneLink / 邀請碼）
  // ★★：有下載連結、社群導流等中度訊號
  // ★：僅有禮包碼、試玩等低度訊號
  let score: 1 | 2 | 3 = 1
  if (highCount >= 1) score = 3
  else if (mediumCount >= 1) score = 2
  else if (lowCount >= 1) score = 1

  return { score, signals: Array.from(new Set(detectedSignals)) }
}
