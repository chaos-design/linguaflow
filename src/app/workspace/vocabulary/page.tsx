import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { VocabularyWorkspace } from "../../../features/vocabulary/vocabulary-workspace"
import { getOptionalAuthUser } from "../../../server/auth/auth-user"
import {
  getLearningTaxonomy,
  getVocabularyWords,
} from "../../../server/learning/queries"

export const metadata: Metadata = {
  title: "生词本",
  description: "整理视频中收藏的单词并跟踪掌握状态。",
}

export default async function VocabularyPage() {
  const user = await getOptionalAuthUser()
  if (!user) {
    redirect("/login?next=%2Fworkspace%2Fvocabulary")
  }
  const [words, taxonomy] = await Promise.all([
    getVocabularyWords(user.id),
    getLearningTaxonomy(user.id),
  ])
  return <VocabularyWorkspace initialWords={words} initialTags={taxonomy.tags} />
}
