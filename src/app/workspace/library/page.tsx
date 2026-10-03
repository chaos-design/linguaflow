import {
  CaptionsIcon,
  CirclePlayIcon,
  LibraryIcon,
  LinkIcon,
  type LucideIcon,
  SearchXIcon,
  TagsIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { PageHeading } from "../../../components/page-heading"
import { Badge } from "../../../components/ui/badge"
import { buttonVariants } from "../../../components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../../components/ui/empty"
import { LibraryFilters } from "../../../features/library/library-filters"
import { VideoCard } from "../../../features/library/video-card"
import { getOptionalAuthUser } from "../../../server/auth/auth-user"
import {
  getLearningTaxonomy,
  getPlaylists,
  getVideos,
} from "../../../server/learning/queries"
import type { VideoSummary } from "../../../types/learning"

export const metadata: Metadata = {
  title: "视频资源库",
  description: "关联本地文件，分类、标记和搜索个人学习视频。",
}

interface LibraryPageProps {
  searchParams: Promise<{
    q?: string | string[]
    category?: string | string[]
    tag?: string | string[]
    status?: string | string[]
    source?: string | string[]
    captions?: string | string[]
  }>
}

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "")
}

function matchesSearch(video: VideoSummary, query: string): boolean {
  if (!query) {
    return true
  }
  return [
    video.title,
    video.description,
    video.category?.name ?? "",
    ...video.tags.map((tag) => tag.name),
  ]
    .join(" ")
    .toLocaleLowerCase("zh-CN")
    .includes(query.toLocaleLowerCase("zh-CN"))
}

function matchesStatus(video: VideoSummary, status: string): boolean {
  if (!status || status === "all") {
    return true
  }
  if (status === "completed") {
    return video.completed
  }
  if (status === "in-progress") {
    return video.completionPercent > 0 && !video.completed
  }
  return video.completionPercent === 0
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const [user, query] = await Promise.all([getOptionalAuthUser(), searchParams])
  if (!user) {
    redirect("/login?next=%2Fworkspace%2Flibrary")
  }

  const [videos, playlists, taxonomy] = await Promise.all([
    getVideos(user.id),
    getPlaylists(user.id),
    getLearningTaxonomy(user.id),
  ])
  const search = firstValue(query.q).trim()
  const category = firstValue(query.category).trim()
  const tag = firstValue(query.tag).trim()
  const status = firstValue(query.status).trim()
  const source = firstValue(query.source).trim()
  const captions = firstValue(query.captions).trim()
  const filteredVideos = videos.filter(
    (video) =>
      matchesSearch(video, search) &&
      (!category || category === "all" || video.category?.name === category) &&
      (!tag || tag === "all" || video.tags.some((item) => item.name === tag)) &&
      matchesStatus(video, status) &&
      (!source || source === "all" || video.sourceType === source) &&
      (!captions ||
        captions === "all" ||
        (captions === "with-captions"
          ? video.transcriptCueCount > 0
          : video.transcriptCueCount === 0)),
  )
  const captionedCount = videos.filter((video) => video.transcriptCueCount > 0).length
  const activeCount = videos.filter(
    (video) => video.completionPercent > 0 && !video.completed,
  ).length
  const defaultTagCount = taxonomy.tags.filter((item) => item.isDefault).length
  const activeFilterCount = [search, category, tag, status, source, captions].filter(
    (value) => value && value !== "all",
  ).length

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7">
      <PageHeading
        eyebrow="LIBRARY"
        title="视频资源库"
        description="集中管理视频、字幕、分类与标签，用组合条件快速回到需要学习的内容。"
        icon={LibraryIcon}
        actions={
          <Link
            href="/workspace/import#link-import"
            className={buttonVariants({ variant: "outline" })}
          >
            <LinkIcon data-icon="inline-start" aria-hidden="true" />
            解析视频链接
          </Link>
        }
      />

      <section
        aria-label="资源库概况"
        className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-2"
      >
        <LibraryMetric icon={LibraryIcon} label="全部视频" value={videos.length} />
        <LibraryMetric icon={CaptionsIcon} label="已有字幕" value={captionedCount} />
        <LibraryMetric icon={CirclePlayIcon} label="正在学习" value={activeCount} />
        <LibraryMetric icon={TagsIcon} label="标签体系" value={taxonomy.tags.length} />
        <span className="text-xs text-muted-foreground">
          {taxonomy.categories.length} 个分类 ·{" "}
          {Math.max(0, videos.length - captionedCount)} 个待补字幕 ·{" "}
          {videos.filter((video) => video.completed).length} 个已完成 ·{" "}
          {defaultTagCount} 个默认标签
        </span>
      </section>

      <LibraryFilters
        categories={taxonomy.categories.map((item) => item.name)}
        tags={taxonomy.tags.map((item) => item.name)}
        initialQuery={search}
        initialCategory={category}
        initialTag={tag}
        initialStatus={status}
        initialSource={source}
        initialCaptions={captions}
      />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">全部资源</h2>
              {activeFilterCount > 0 ? (
                <Badge variant="secondary">{activeFilterCount} 项条件</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              显示 {filteredVideos.length} / {videos.length} 个视频
            </p>
          </div>
          {defaultTagCount > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">默认标签</span>
              {taxonomy.tags
                .filter((item) => item.isDefault)
                .map((item) => (
                  <Badge key={item.id} variant="outline">
                    {item.name}
                  </Badge>
                ))}
            </div>
          ) : null}
        </div>

        {filteredVideos.length > 0 ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
            {filteredVideos.map((video, index) => (
              <VideoCard
                key={video.id}
                video={video}
                categories={taxonomy.categories}
                playlists={playlists}
                imageLoading={index < 3 ? "eager" : "lazy"}
              />
            ))}
          </div>
        ) : (
          <Empty className="min-h-96 border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                {videos.length === 0 ? <LibraryIcon /> : <SearchXIcon />}
              </EmptyMedia>
              <EmptyTitle>
                {videos.length === 0 ? "资源库里还没有视频" : "没有匹配的视频"}
              </EmptyTitle>
              <EmptyDescription>
                {videos.length === 0
                  ? "导入视频时可同时配置字幕、分类和默认标签。"
                  : "重置部分筛选条件后再试一次。"}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>
    </div>
  )
}

function LibraryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: number
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
      <strong className="font-mono text-sm text-foreground">{value}</strong>
    </span>
  )
}
