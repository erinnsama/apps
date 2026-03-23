import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Game Intel Tracker',
  description: '遊戲競品合作偵測平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
