import { NextRequest, NextResponse } from 'next/server'
import { exportToSheets } from '@/lib/sheets'

export async function POST(req: NextRequest) {
  const { results, sheetId } = await req.json()
  try {
    await exportToSheets(results, sheetId)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
