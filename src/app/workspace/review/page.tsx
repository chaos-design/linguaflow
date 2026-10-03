import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ReviewWorkspace } from "../../../features/review/review-workspace"
import { getOptionalAuthUser } from "../../../server/auth/auth-user"
import {
  getDueReviewCards,
  getLearningPreferences,
} from "../../../server/learning/queries"

export const metadata: Metadata = {
  title: "复习闪卡",
  description: "使用间隔重复复习视频中收藏的生词。",
}

export default async function ReviewPage() {
  const user = await getOptionalAuthUser()
  if (!user) {
    redirect("/login?next=%2Fworkspace%2Freview")
  }
  const [cards, preferences] = await Promise.all([
    getDueReviewCards(user.id),
    getLearningPreferences(user.id),
  ])

  return (
    <ReviewWorkspace
      cards={cards}
      defaultReviewTarget={preferences.reviewTarget}
      reviewSeed={Date.now()}
    />
  )
}
