import type { Metadata } from "next"
import { BatchImportWorkspace } from "../../../../features/import/batch-import-workspace"

export const metadata: Metadata = {
  title: "批量导入",
  description: "批量解析视频链接并处理失败重试。",
}

export default function BatchImportPage() {
  return <BatchImportWorkspace />
}
