import type { Metadata } from "next"
import { LandingPage } from "../components/landing-page"
import { getOptionalAuthUser } from "../server/auth/auth-user"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: {
    absolute: "LinguaFlow · 视频学习助手",
  },
  description: "把视频、双语字幕、时间戳笔记、生词和复习进度集中在一个学习工作台。",
}

export default async function HomePage() {
  const user = await getOptionalAuthUser()
  return <LandingPage entryHref={user ? "/workspace" : "/login"} />
}
