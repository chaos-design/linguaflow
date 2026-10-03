import type { Metadata } from "next"
import { ComponentStatesReference } from "../../../../features/reference/component-states-reference"

export const metadata: Metadata = {
  title: "场景与状态规范",
  description: "LinguaFlow 界面组件状态与边界场景。",
}

export default function StatesPage() {
  return <ComponentStatesReference />
}
