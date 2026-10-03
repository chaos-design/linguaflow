import type { Metadata } from "next"
import { ColorSystemReference } from "../../../../features/reference/color-system-reference"

export const metadata: Metadata = {
  title: "配色与主题规范",
  description: "LinguaFlow 语义色彩和双主题设计令牌。",
}

export default function ColorsPage() {
  return <ColorSystemReference />
}
