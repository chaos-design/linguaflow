import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { VideoLearningPlayer } from "../../../../features/player/video-learning-player"
import { getOptionalAuthUser } from "../../../../server/auth/auth-user"
import {
  getLearningPreferences,
  getVideoDetail,
} from "../../../../server/learning/queries"

interface VideoPageProps {
  params: Promise<{ "video-id": string }>
}

export const metadata: Metadata = {
  title: "视频学习",
  description: "播放学习视频、自动同步进度并整理时间戳笔记。",
}

export default async function VideoPage({ params }: VideoPageProps) {
  const [user, routeParams] = await Promise.all([getOptionalAuthUser(), params])
  if (!user) {
    redirect("/login?next=%2Fworkspace")
  }

  const [video, preferences] = await Promise.all([
    getVideoDetail(user.id, routeParams["video-id"]),
    getLearningPreferences(user.id),
  ])
  if (!video) {
    notFound()
  }

  return <VideoLearningPlayer video={video} preferences={preferences} />
}
