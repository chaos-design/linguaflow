"use client"

import {
  CheckCheckIcon,
  CheckIcon,
  CircleXIcon,
  FilePlusIcon,
  LayersIcon,
  LinkIcon,
  ListChecksIcon,
  ListVideoIcon,
  LoaderCircleIcon,
  PlayIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { PageHeading } from "../../components/page-heading"
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"
import { Badge } from "../../components/ui/badge"
import { Button, buttonVariants } from "../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty"
import { Progress } from "../../components/ui/progress"
import { Textarea } from "../../components/ui/textarea"
import {
  importVideoFromUrl,
  importVideoLinks,
  inspectVideoLink,
  inspectVideoLinks,
} from "../../server/learning/actions"

type QueueStatus = "ready" | "failed"

interface QueueItem {
  id: string
  title: string
  sourceUrl: string
  source: string
  detail: string
  status: QueueStatus
  cached: boolean
  existingVideoId: string | null
}

const failureReasons = [
  ["链接不可公开访问", "确认视频没有被删除、设为私密或要求登录。"],
  ["平台限制元数据读取", "可改用资源库中的手动链接导入。"],
  ["不是公网 HTTP 地址", "本地和内网链接不会由服务端请求。"],
  ["请求超时", "稍后可对单个失败项重新解析。"],
] as const

export function BatchImportWorkspace() {
  const router = useRouter()
  const [links, setLinks] = useState("")
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [refreshItem, setRefreshItem] = useState<QueueItem | null>(null)
  const [isPending, startTransition] = useTransition()
  const recognizedLinks = useMemo(
    () =>
      Array.from(
        new Set(
          links
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ).slice(0, 50),
    [links],
  )
  const counts = useMemo(
    () => ({
      ready: queue.filter((item) => item.status === "ready").length,
      failed: queue.filter((item) => item.status === "failed").length,
    }),
    [queue],
  )
  const completion = queue.length > 0 ? (counts.ready / queue.length) * 100 : 0

  function parseAll() {
    if (recognizedLinks.length === 0) {
      toast.error("请先粘贴至少一个视频链接。")
      return
    }
    startTransition(async () => {
      const result = await inspectVideoLinks(recognizedLinks)
      if (!result.ok || !result.data) {
        toast.error(result.message)
        return
      }
      const readyItems: QueueItem[] = result.data.videos.map((video) => ({
        id: video.sourceUrl,
        title: video.title,
        sourceUrl: video.sourceUrl,
        source: video.provider,
        detail: [
          video.cached ? "已存解析" : null,
          video.durationSeconds > 0
            ? `${Math.round(video.durationSeconds / 60)} 分钟`
            : "元数据已就绪",
          video.detectedCaptions ? `${video.detectedCaptions.cueCount} 条字幕` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        status: "ready",
        cached: video.cached,
        existingVideoId: video.existingVideoId,
      }))
      const failedItems: QueueItem[] = result.data.failures.map((failure) => ({
        id: failure.sourceUrl,
        title: failure.sourceUrl,
        sourceUrl: failure.sourceUrl,
        source: "未知来源",
        detail: failure.message,
        status: "failed",
        cached: false,
        existingVideoId: null,
      }))
      setQueue([...readyItems, ...failedItems])
      toast.info(result.message)
    })
  }

  function retryItem(item: QueueItem) {
    startTransition(async () => {
      const result = await inspectVideoLink(item.sourceUrl, { forceRefresh: true })
      if (!result.ok || !result.data) {
        setQueue((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, detail: result.message } : entry,
          ),
        )
        toast.error(result.message)
        return
      }
      const video = result.data
      setQueue((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                title: video.title,
                source: video.provider,
                detail: video.detectedCaptions
                  ? `元数据已就绪 · ${video.detectedCaptions.cueCount} 条字幕`
                  : "元数据已就绪",
                status: "ready",
                cached: false,
                existingVideoId: video.existingVideoId,
              }
            : entry,
        ),
      )
      toast.success("链接已重新解析。")
    })
  }

  function importReadyItems() {
    const sourceUrls = queue
      .filter((item) => item.status === "ready")
      .map((item) => item.sourceUrl)
    startTransition(async () => {
      const result = await importVideoLinks(sourceUrls)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      router.push("/workspace/library")
      router.refresh()
    })
  }

  function importOne(item: QueueItem) {
    startTransition(async () => {
      const result = await importVideoFromUrl(item.sourceUrl)
      if (!result.ok || !result.data) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      router.push("/workspace/library")
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
      <PageHeading
        eyebrow="BATCH IMPORT"
        title="批量导入"
        description="一次校验最多 50 个公开视频链接，失败项目可以单独重试，不阻塞其余队列。"
        icon={LayersIcon}
        actions={
          <>
            <Link
              href="/workspace/import"
              className={buttonVariants({ variant: "outline" })}
            >
              <FilePlusIcon data-icon="inline-start" aria-hidden="true" />
              单个导入
            </Link>
            <Button type="button" disabled={isPending} onClick={parseAll}>
              {isPending ? (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
              ) : (
                <PlayIcon data-icon="inline-start" aria-hidden="true" />
              )}
              全部解析
            </Button>
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.7fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecksIcon className="size-4" aria-hidden="true" />
                批量粘贴链接
              </CardTitle>
              <CardDescription>每行一个链接，自动去重，最多 50 个。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea
                rows={7}
                value={links}
                placeholder={
                  "https://www.youtube.com/watch?v=...\nhttps://www.bilibili.com/video/BV...\nhttps://vimeo.com/..."
                }
                onChange={(event) => setLinks(event.target.value)}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  已识别 {recognizedLinks.length} 个唯一链接
                </p>
                <Button size="sm" type="button" disabled={isPending} onClick={parseAll}>
                  <PlayIcon data-icon="inline-start" aria-hidden="true" />
                  加入解析队列
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListVideoIcon className="size-4" aria-hidden="true" />
                队列明细
              </CardTitle>
              <CardDescription>
                {queue.length > 0
                  ? `${counts.ready} / ${queue.length} 已就绪`
                  : "队列中还没有链接"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queue.length > 0 ? (
                <div className="divide-y">
                  {queue.map((item) => (
                    <QueueRow
                      key={item.id}
                      item={item}
                      disabled={isPending}
                      onImport={() => importOne(item)}
                      onRemove={() =>
                        setQueue((current) =>
                          current.filter((entry) => entry.id !== item.id),
                        )
                      }
                      onRetry={() => retryItem(item)}
                      onRefresh={() => setRefreshItem(item)}
                    />
                  ))}
                </div>
              ) : (
                <Empty className="min-h-72">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ListVideoIcon />
                    </EmptyMedia>
                    <EmptyTitle>队列还是空的</EmptyTitle>
                    <EmptyDescription>
                      在上方粘贴多个视频链接，或先从单个导入开始。
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Link
                      href="/workspace/import"
                      className={buttonVariants({ variant: "outline" })}
                    >
                      <FilePlusIcon data-icon="inline-start" aria-hidden="true" />
                      单个导入
                    </Link>
                  </EmptyContent>
                </Empty>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>解析队列</CardTitle>
              <CardDescription>仅已验证的链接可以批量入库。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>可导入比例</span>
                <span className="font-mono">{Math.round(completion)}%</span>
              </div>
              <Progress value={completion} />
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted p-3 text-center">
                  <p className="font-mono text-lg font-semibold">{counts.ready}</p>
                  <p className="text-xs text-muted-foreground">已就绪</p>
                </div>
                <div className="rounded-md bg-muted p-3 text-center">
                  <p className="font-mono text-lg font-semibold text-destructive">
                    {counts.failed}
                  </p>
                  <p className="text-xs text-muted-foreground">失败</p>
                </div>
              </div>
              <Button
                variant="outline"
                type="button"
                disabled={isPending || counts.failed === 0}
                onClick={() => {
                  const failed = queue.filter((item) => item.status === "failed")
                  for (const item of failed) {
                    retryItem(item)
                  }
                }}
              >
                <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
                重试失败项 ({counts.failed})
              </Button>
            </CardContent>
          </Card>

          <Alert>
            <ShieldAlertIcon aria-hidden="true" />
            <AlertTitle>服务端安全校验</AlertTitle>
            <AlertDescription>
              本地、内网和非 HTTP 地址不会被请求，只读取平台公开元数据与字幕。
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>失败排查</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {failureReasons.map(([title, description]) => (
                <div key={title} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-xs font-medium">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="sticky bottom-0 z-20 flex flex-col justify-between gap-3 rounded-t-md border bg-background/95 p-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.45)] backdrop-blur sm:flex-row sm:items-center">
        <p className="text-xs text-muted-foreground">
          入库后可在资源库继续分类和加入播放列表。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            type="button"
            disabled={queue.length === 0}
            onClick={() => setQueue([])}
          >
            清空队列
          </Button>
          <Button
            type="button"
            disabled={isPending || counts.ready === 0}
            onClick={importReadyItems}
          >
            <CheckCheckIcon data-icon="inline-start" aria-hidden="true" />
            全部加入资源库 ({counts.ready})
          </Button>
        </div>
      </footer>

      <Dialog
        open={Boolean(refreshItem)}
        onOpenChange={(open) => {
          if (!open) {
            setRefreshItem(null)
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>重新解析这个视频？</DialogTitle>
            <DialogDescription>
              当前已有保存的解析结果。重新解析会访问视频平台，并仅更新缓存
              {refreshItem?.existingVideoId ? "和资源库中的原视频" : ""}
              ，不会创建重复资源。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefreshItem(null)}
            >
              继续使用已存结果
            </Button>
            <Button
              type="button"
              disabled={isPending || !refreshItem}
              onClick={() => {
                if (refreshItem) {
                  retryItem(refreshItem)
                }
                setRefreshItem(null)
              }}
            >
              重新解析并更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QueueRow({
  item,
  disabled,
  onImport,
  onRemove,
  onRetry,
  onRefresh,
}: {
  item: QueueItem
  disabled: boolean
  onImport: () => void
  onRemove: () => void
  onRetry: () => void
  onRefresh: () => void
}) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
          {item.status === "ready" ? (
            <CheckIcon className="size-4" aria-hidden="true" />
          ) : (
            <CircleXIcon className="size-4 text-destructive" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline">
              <LinkIcon aria-hidden="true" />
              {item.source}
            </Badge>
            <span>{item.detail}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {item.status === "ready" ? (
            <>
              {item.cached ? (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={disabled}
                  onClick={onRefresh}
                >
                  <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
                  重新解析
                </Button>
              ) : null}
              <Button size="sm" type="button" disabled={disabled} onClick={onImport}>
                <PlayIcon data-icon="inline-start" aria-hidden="true" />
                导入
              </Button>
            </>
          ) : (
            <Button size="sm" type="button" disabled={disabled} onClick={onRetry}>
              <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
              重试
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={`移除 ${item.title}`}
            onClick={onRemove}
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
