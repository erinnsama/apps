import { google } from 'googleapis'
import type { SearchResult } from './types'
import fs from 'fs'

export async function exportToSheets(results: SearchResult[], sheetId: string) {
  let credentials: any
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  } else {
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH
    if (!keyPath) throw new Error('請設定 GOOGLE_SERVICE_ACCOUNT_JSON 或 GOOGLE_SERVICE_ACCOUNT_PATH')
    credentials = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  const sheets = google.sheets({ version: 'v4', auth })

  const headers = [
    '平台', '標題', '頻道/帳號', '地區', '發布日期',
    '疑似程度(1-3)', '合作訊號', '觀看數', '按讚數', '留言數', '轉推數', '連結'
  ]

  const rows = results.map(r => [
    r.platform === 'youtube' ? 'YouTube' : 'Twitter/X',
    r.title,
    r.channelName,
    r.region,
    r.publishedAt,
    r.score,
    r.signals.join(' | '),
    r.viewCount ?? '',
    r.likeCount ?? '',
    r.commentCount ?? '',
    r.retweetCount ?? '',
    r.url,
  ])

  const targetId = sheetId || process.env.DEFAULT_SHEET_ID
  if (!targetId) throw new Error('請提供 Google Sheet ID')

  // 取得第一個分頁的名稱（相容中英文介面）
  const meta = await sheets.spreadsheets.get({ spreadsheetId: targetId })
  const firstSheet = meta.data.sheets?.[0]?.properties?.title || 'Sheet1'

  // 清除舊資料並寫入
  await sheets.spreadsheets.values.clear({
    spreadsheetId: targetId,
    range: firstSheet,
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: targetId,
    range: `${firstSheet}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers, ...rows] },
  })
}
