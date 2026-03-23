import { google } from 'googleapis'
import type { SearchResult } from './types'
import fs from 'fs'

export async function exportToSheets(results: SearchResult[], sheetId: string) {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH
  if (!keyPath) throw new Error('GOOGLE_SERVICE_ACCOUNT_PATH 未設定')

  const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))

  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
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

  // 清除舊資料並寫入
  await sheets.spreadsheets.values.clear({
    spreadsheetId: targetId,
    range: 'Sheet1',
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId: targetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [headers, ...rows] },
  })
}
