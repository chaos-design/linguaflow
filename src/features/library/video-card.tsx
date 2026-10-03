"use client"

import {
  CaptionsIcon,
  Clock3Icon,
  HardDriveIcon,
  LinkIcon,
  PlayIcon,
  UploadIcon,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Badge } from "../../components/ui/badge"
import { buttonVariants } from "../../components/ui/button"
import { Card } from "../../components/ui/card"
import { Progress } from "../../components/ui/progress"
import { formatDuration, formatRelativeDate } from "../../lib/format"
import { cn } from "../../lib/utils"
import type {
  LearningCategory,
  PlaylistSummary,
  VideoSummary,
} from "../../types/learning"
import { VideoActionsMenu } from "./video-actions-menu"

export function VideoCard({
  video,
  categories = [],
  playlists = [],
  imageLoading = "lazy",
  compact = false,
}: {
  video: VideoSummary
  categories?: LearningCategory[]
  playlists?: PlaylistSummary[]
  imageLoading?: "eager" | "lazy"
  compact?: boolean
}) {
  const [category, setCategory] = useState(video.category)
  const [transcriptCueCount, setTranscriptCueCount] = useState(video.transcriptCueCount)

  useEffect(() => {
    setCategory(video.category)
  }, [video.category])

  useEffect(() => {
    setTranscriptCueCount(video.transcriptCueCount)
  }, [video.transcriptCueCount])

  return (
    <Card
      className={cn(
        "grid h-full min-w-0 grid-cols-1 content-start gap-0 overflow-hidden py-0 transition-colors hover:bg-muted/20 sm:grid-cols-[minmax(140px,0.58fr)_minmax(0,1.42fr)]",
        compact
          ? "sm:min-h-36 sm:grid-cols-[minmax(140px,0.62fr)_minmax(0,1.38fr)]"
          : "sm:min-h-38",
      )}
      size="sm"
    >
      <Link
        href={`/workspace/videos/${video.id}`}
        className="group/media relative aspect-video overflow-hidden bg-black sm:m-3 sm:mr-0 sm:self-start sm:rounded-md"
        aria-label={`打开视频：${video.title}`}
      >
        <Image
          src={video.thumbnailUrl ?? "/images/linguaflow-course-cover.jpg"}
          alt=""
          fill
          loading={imageLoading}
          sizes="(max-width: 640px) 38vw, (max-width: 1280px) 34vw, 18vw"
          className="object-cover transition-transform duration-300 group-hover/media:scale-[1.02]"
        />
        <span className="absolute inset-0 bg-black/15 transition-colors group-hover/media:bg-black/25" />
        <span className="absolute top-1/2 left-1/2 grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground shadow-sm">
          <PlayIcon className="size-3.5 translate-x-px" aria-hidden="true" />
        </span>
        <Badge className="absolute right-2 bottom-2 font-mono" variant="secondary">
          {formatDuration(video.durationSeconds)}
        </Badge>
      </Link>

      <div className="flex min-w-0 flex-col p-2.5 sm:p-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="outline">{category?.name ?? "未分类"}</Badge>
            <span className="truncate text-xs text-muted-foreground">
              {formatRelativeDate(video.lastWatchedAt ?? video.createdAt)}
            </span>
          </div>
          <VideoActionsMenu
            video={{ ...video, category, transcriptCueCount }}
            categories={categories}
            playlists={playlists}
            onCategoryChange={setCategory}
            onTranscriptImported={setTranscriptCueCount}
          />
        </div>

        <h3 className="mt-2 line-clamp-2 text-sm leading-snug font-semibold">
          <Link href={`/workspace/videos/${video.id}`}>{video.title}</Link>
        </h3>
        {compact ? null : (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {video.description || "暂无视频简介"}
          </p>
        )}

        {compact ? null : (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Badge variant="outline">
              {video.sourceType === "local" ? (
                <HardDriveIcon aria-hidden="true" />
              ) : video.sourceType === "upload" ? (
                <UploadIcon aria-hidden="true" />
              ) : (
                <LinkIcon aria-hidden="true" />
              )}
              {video.sourceType === "local"
                ? "本地"
                : video.sourceType === "upload"
                  ? "历史上传"
                  : "链接"}
            </Badge>
            <Badge variant={transcriptCueCount > 0 ? "secondary" : "outline"}>
              <CaptionsIcon aria-hidden="true" />
              {transcriptCueCount > 0 ? `${transcriptCueCount} 条字幕` : "待补字幕"}
            </Badge>
            {video.tags.slice(0, 1).map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
            {video.tags.length > 1 ? (
              <Badge variant="outline">+{video.tags.length - 1}</Badge>
            ) : null}
          </div>
        )}

        <div className={cn("mt-auto", compact ? "pt-2" : "pt-3")}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">
              {video.completed
                ? "已完成"
                : video.completionPercent > 0
                  ? "学习中"
                  : "未开始"}
            </span>
            <span className="font-mono text-muted-foreground">
              {Math.round(video.completionPercent)}%
            </span>
          </div>
          <Progress className="mt-1.5" value={video.completionPercent} />
          <div
            className={cn(
              "flex items-center justify-between gap-3",
              compact ? "mt-1" : "mt-2",
            )}
          >
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3Icon className="size-3.5" aria-hidden="true" />
              {formatDuration(video.positionSeconds)}
            </span>
            <Link
              href={`/workspace/videos/${video.id}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {video.completionPercent > 0 ? "继续" : "开始"}
              <PlayIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </Card>
  )
}
