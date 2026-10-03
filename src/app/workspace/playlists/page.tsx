import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { PlaylistsWorkspace } from "../../../features/playlists/playlists-workspace"
import { getOptionalAuthUser } from "../../../server/auth/auth-user"
import { getPlaylists } from "../../../server/learning/queries"

export const metadata: Metadata = {
  title: "播放列表",
  description: "按主题、目标和学习阶段组织视频。",
}

export default async function PlaylistsPage() {
  const user = await getOptionalAuthUser()
  if (!user) {
    redirect("/login?next=%2Fworkspace%2Fplaylists")
  }
  const playlists = await getPlaylists(user.id)

  return <PlaylistsWorkspace initialPlaylists={playlists} />
}
