import { SettingsIcon } from "lucide-react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { PageHeading } from "../../../components/page-heading"
import { Badge } from "../../../components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card"
import { SettingsForm } from "../../../features/settings/settings-form"
import { getOptionalAuthUser } from "../../../server/auth/auth-user"
import {
  getLearningPreferences,
  getLearningTaxonomy,
  getVocabularyWords,
} from "../../../server/learning/queries"

export const metadata: Metadata = {
  title: "设置",
  description: "管理 LinguaFlow 账户、主题与学习偏好。",
}

export default async function SettingsPage() {
  const user = await getOptionalAuthUser()
  if (!user) {
    redirect("/login?next=%2Fworkspace%2Fsettings")
  }
  const [preferences, words, taxonomy] = await Promise.all([
    getLearningPreferences(user.id),
    getVocabularyWords(user.id),
    getLearningTaxonomy(user.id),
  ])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <PageHeading
        eyebrow="SETTINGS"
        title="设置"
        description="管理账户信息、界面主题、字幕、复习节奏与解析偏好。"
        icon={SettingsIcon}
      />

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>账户</CardTitle>
          <CardDescription>当前登录身份与数据同步状态。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{user.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              视频、进度、笔记和播放列表通过 Supabase 同步。
            </p>
          </div>
          <Badge variant="outline">已连接</Badge>
        </CardContent>
      </Card>

      <SettingsForm
        initialPreferences={preferences}
        tags={taxonomy.tags}
        words={words}
      />
    </div>
  )
}
