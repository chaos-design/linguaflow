"use client"

import {
  CheckSquareIcon,
  ListVideoIcon,
  PlayIcon,
  SquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "../../components/ui/badge"
import { Button, buttonVariants } from "../../components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import { Checkbox } from "../../components/ui/checkbox"
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
import { Spinner } from "../../components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { formatDuration, formatRelativeDate } from "../../lib/format"
import { cn } from "../../lib/utils"
import { deletePlaylists, removeVideoFromPlaylist } from "../../server/learning/actions"
import type { PlaylistSummary } from "../../types/learning"
import { CreatePlaylistDialog } from "./create-playlist-dialog"

export function PlaylistsWorkspace({
  initialPlaylists,
}: {
  initialPlaylists: PlaylistSummary[]
}) {
  const router = useRouter()
  const [playlists, setPlaylists] = useState(initialPlaylists)
  const [managing, setManaging] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>())
  const [deleteIds, setDeleteIds] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  function togglePlaylist(playlistId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(playlistId)) {
        next.delete(playlistId)
      } else {
        next.add(playlistId)
      }
      return next
    })
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deletePlaylists(deleteIds)
      if (!result.ok || !result.data) {
        toast.error(result.message)
        return
      }
      const deletedIds = new Set(result.data.deletedIds)
      setPlaylists((current) =>
        current.filter((playlist) => !deletedIds.has(playlist.id)),
      )
      setSelectedIds((current) => {
        const next = new Set(current)
        for (const id of deletedIds) {
          next.delete(id)
        }
        return next
      })
      setDeleteIds([])
      toast.success(result.message)
      router.refresh()
    })
  }

  function removeVideo(playlistId: string, videoId: string) {
    startTransition(async () => {
      const result = await removeVideoFromPlaylist({ playlistId, videoId })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                videos: playlist.videos.filter((video) => video.id !== videoId),
                videoCount: Math.max(0, playlist.videoCount - 1),
                totalDurationSeconds: playlist.videos
                  .filter((video) => video.id !== videoId)
                  .reduce((total, video) => total + video.durationSeconds, 0),
              }
            : playlist,
        ),
      )
      toast.success(result.message)
      router.refresh()
    })
  }

  const allSelected = playlists.length > 0 && selectedIds.size === playlists.length

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-medium text-muted-foreground">PLAYLISTS</p>
          <h1 className="mt-1 text-2xl font-semibold">播放列表</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            把零散视频组织成有顺序、可持续推进的学习路径。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {playlists.length > 0 ? (
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setManaging((current) => !current)
                setSelectedIds(new Set())
              }}
            >
              {managing ? (
                <XIcon data-icon="inline-start" aria-hidden="true" />
              ) : (
                <CheckSquareIcon data-icon="inline-start" aria-hidden="true" />
              )}
              {managing ? "完成管理" : "批量管理"}
            </Button>
          ) : null}
          <CreatePlaylistDialog />
        </div>
      </section>

      {managing ? (
        <section className="flex flex-wrap items-center justify-between gap-3 bg-muted px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() =>
              setSelectedIds(
                allSelected ? new Set() : new Set(playlists.map((item) => item.id)),
              )
            }
          >
            {allSelected ? (
              <CheckSquareIcon data-icon="inline-start" aria-hidden="true" />
            ) : (
              <SquareIcon data-icon="inline-start" aria-hidden="true" />
            )}
            {allSelected ? "取消全选" : "全选"}
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              已选择 {selectedIds.size} 个
            </span>
            <Button
              variant="destructive"
              size="sm"
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => setDeleteIds(Array.from(selectedIds))}
            >
              <Trash2Icon data-icon="inline-start" aria-hidden="true" />
              删除
            </Button>
          </div>
        </section>
      ) : null}

      {playlists.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {playlists.map((playlist) => {
            const completedCount = playlist.videos.filter(
              (video) => video.completed,
            ).length
            const completion =
              playlist.videoCount > 0 ? (completedCount / playlist.videoCount) * 100 : 0
            const pendingDeletion = deleteIds.includes(playlist.id)

            return (
              <Card
                key={playlist.id}
                data-delete-pending={pendingDeletion}
                className={cn(
                  "relative transition-[background-color,border-color,box-shadow]",
                  pendingDeletion &&
                    "border-destructive bg-destructive/5 ring-2 ring-destructive/30",
                )}
              >
                {managing ? (
                  <Checkbox
                    className="absolute top-4 right-4"
                    aria-label={`选择 ${playlist.name}`}
                    checked={selectedIds.has(playlist.id)}
                    onCheckedChange={() => togglePlaylist(playlist.id)}
                  />
                ) : null}
                <CardHeader className={managing ? "pr-12" : undefined}>
                  <CardTitle>{playlist.name}</CardTitle>
                  <CardDescription>
                    {playlist.description || "暂无列表简介"}
                  </CardDescription>
                  {!managing ? (
                    <CardAction className="flex items-center gap-1">
                      <Badge variant="secondary">{playlist.videoCount} 个视频</Badge>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              type="button"
                              aria-label={`删除播放列表 ${playlist.name}`}
                              onClick={() => setDeleteIds([playlist.id])}
                            />
                          }
                        >
                          <Trash2Icon aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>删除播放列表</TooltipContent>
                      </Tooltip>
                    </CardAction>
                  ) : null}
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        已完成 {completedCount} / {playlist.videoCount}
                      </span>
                      <span>
                        总时长 {formatDuration(playlist.totalDurationSeconds)}
                      </span>
                    </div>
                    <Progress value={completion} />
                  </div>

                  {playlist.videos.length > 0 ? (
                    <ul className="divide-y rounded-md border">
                      {playlist.videos.map((video, index) => (
                        <li
                          key={video.id}
                          className="grid grid-cols-[28px_72px_minmax(0,1fr)_auto] items-center gap-3 p-3"
                        >
                          <span className="font-mono text-xs text-muted-foreground">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="relative aspect-video overflow-hidden rounded-md bg-muted">
                            <Image
                              src={
                                video.thumbnailUrl ??
                                "/images/linguaflow-course-cover.jpg"
                              }
                              alt=""
                              fill
                              sizes="72px"
                              className="object-cover"
                            />
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/workspace/videos/${video.id}`}
                              className="block truncate text-sm font-medium hover:text-primary"
                            >
                              {video.title}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeDate(video.lastWatchedAt)}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    type="button"
                                    aria-label={`从 ${playlist.name} 移除 ${video.title}`}
                                    disabled={isPending}
                                    onClick={() => removeVideo(playlist.id, video.id)}
                                  />
                                }
                              >
                                <XIcon aria-hidden="true" />
                              </TooltipTrigger>
                              <TooltipContent>移出列表</TooltipContent>
                            </Tooltip>
                            <Link
                              href={`/workspace/videos/${video.id}`}
                              className={buttonVariants({
                                variant: "ghost",
                                size: "icon-sm",
                              })}
                              aria-label={`播放 ${video.title}`}
                            >
                              <PlayIcon aria-hidden="true" />
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed p-3">
                      <p className="text-xs text-muted-foreground">
                        从资源卡片菜单加入视频，加入顺序就是学习顺序。
                      </p>
                      <Link
                        href="/workspace/library"
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        添加视频
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </section>
      ) : (
        <Empty className="min-h-80 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListVideoIcon />
            </EmptyMedia>
            <EmptyTitle>还没有播放列表</EmptyTitle>
            <EmptyDescription>
              新建列表后，可从视频卡片菜单把资源加入学习路径。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <CreatePlaylistDialog />
          </EmptyContent>
        </Empty>
      )}

      <Dialog
        open={deleteIds.length > 0}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setDeleteIds([])
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除播放列表</DialogTitle>
            <DialogDescription>
              将删除 {deleteIds.length} 个播放列表及其编排关系，视频资源不会被删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={isPending}
              onClick={() => setDeleteIds([])}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={isPending}
              onClick={confirmDelete}
            >
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2Icon data-icon="inline-start" aria-hidden="true" />
              )}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
