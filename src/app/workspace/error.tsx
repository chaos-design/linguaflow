"use client"

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react"
import { useEffect } from "react"
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"
import { Button } from "../../components/ui/button"

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[60svh] w-full max-w-2xl items-center">
      <Alert variant="destructive">
        <AlertTriangleIcon aria-hidden="true" />
        <AlertTitle>学习数据加载失败</AlertTitle>
        <AlertDescription className="flex flex-col gap-4">
          <span>请检查网络连接和 Supabase 配置，然后重新加载。</span>
          <Button className="self-start" variant="outline" onClick={reset}>
            <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
            重新加载
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
