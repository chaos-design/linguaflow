import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ImportWorkspace } from "../../../features/import/import-workspace"
import { getOptionalAuthUser } from "../../../server/auth/auth-user"
import { getLearningTaxonomy, getVideos } from "../../../server/learning/queries"

export const metadata: Metadata = {
  title: "导入视频",
  description: "检测页面视频、解析链接或导入本地视频。",
}

export default async function ImportPage() {
  const user = await getOptionalAuthUser()
  if (!user) {
    redirect("/login?next=%2Fworkspace%2Fimport")
  }
  const [videos, taxonomy] = await Promise.all([
    getVideos(user.id),
    getLearningTaxonomy(user.id),
  ])

  return (
    <ImportWorkspace
      recentVideos={videos.slice(0, 4)}
      categories={taxonomy.categories}
      tags={taxonomy.tags}
    />
  )
}
