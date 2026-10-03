import type { Metadata } from "next"
import { ArchitectureReference } from "../../../../features/reference/architecture-reference"

export const metadata: Metadata = {
  title: "技术流程与数据流",
  description: "LinguaFlow 视频解析、字幕与学习闭环架构。",
}

export default function ArchitecturePage() {
  return <ArchitectureReference />
}
