import type { Metadata } from "next"
import { Providers } from "../components/providers"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "LinguaFlow 视频学习助手",
    template: "%s · LinguaFlow",
  },
  description: "集中管理学习视频、观看进度、时间戳笔记与播放列表。",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
