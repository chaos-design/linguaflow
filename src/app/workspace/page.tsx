import {
  BookOpenCheckIcon,
  Clock3Icon,
  FlameIcon,
  ListVideoIcon,
  NotebookPenIcon,
  PlayIcon,
} from "lucide-react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Badge } from "../../components/ui/badge"
import { buttonVariants } from "../../components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty"
import { VideoCard } from "../../features/library/video-card"
import { CreatePlaylistDialog } from "../../features/playlists/create-playlist-dialog"
import { formatDuration, formatLearningTime } from "../../lib/format"
import { getOptionalAuthUser } from "../../server/auth/auth-user"
import {
  getLearningTaxonomy,
  getWorkspaceOverview,
} from "../../server/learning/queries"
import type { PlaylistSummary } from "../../types/learning"

export const metadata: Metadata = {
  title: "学习概览",
  description: "查看学习进度、最近视频、播放列表和本周学习数据。",
}

export default async function WorkspacePage() {
  const user = await getOptionalAuthUser()
  if (!user) {
    redirect("/login?next=%2Fworkspace")
  }
  const [overview, taxonomy] = await Promise.all([
    getWorkspaceOverview(user.id),
    getLearningTaxonomy(user.id),
  ])
  const { stats } = overview

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Badge variant="secondary">今日学习空间</Badge>
          <h1 className="mt-3 text-2xl font-semibold md:text-3xl">
            把观看变成可积累的学习。
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            从上次停下的位置继续，边看边记，完成今天的学习计划。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreatePlaylistDialog />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Clock3Icon}
          label="累计学习"
          value={formatLearningTime(stats.totalLearningSeconds)}
          detail="已记录有效观看时长"
        />
        <StatCard
          icon={BookOpenCheckIcon}
          label="完成视频"
          value={`${stats.completedVideos} 个`}
          detail={`${stats.activeVideos} 个正在学习`}
        />
        <StatCard
          icon={NotebookPenIcon}
          label="时间戳笔记"
          value={`${stats.totalNotes} 条`}
          detail="随视频进度准确定位"
        />
        <StatCard
          icon={FlameIcon}
          label="连续学习"
          value={`${stats.currentStreakDays} 天`}
          detail="保持稳定的小步推进"
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">CONTINUE</p>
            <h2 className="mt-1 text-xl font-semibold">继续学习</h2>
          </div>
          <Link
            href="/workspace/library"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            查看全部
          </Link>
        </div>

        {overview.continueWatching.length > 0 ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            {overview.continueWatching.slice(0, 2).map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                categories={taxonomy.categories}
                playlists={overview.playlists}
                imageLoading="eager"
                compact
              />
            ))}
          </div>
        ) : (
          <Empty className="min-h-52 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PlayIcon />
              </EmptyMedia>
              <EmptyTitle>没有待继续的视频</EmptyTitle>
              <EmptyDescription>
                从资源库打开一个视频，观看进度会自动出现在这里。
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/workspace/library" className={buttonVariants()}>
                打开资源库
              </Link>
            </EmptyContent>
          </Empty>
        )}
      </section>

      <LearningPathsSection playlists={overview.playlists} />

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">RECENT</p>
            <h2 className="mt-1 text-xl font-semibold">最近添加</h2>
          </div>
          <Link
            href="/workspace/library"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            打开资源库
          </Link>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          {overview.recentVideos.slice(0, 3).map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              categories={taxonomy.categories}
              playlists={overview.playlists}
              imageLoading="eager"
              compact
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function LearningPathsSection({ playlists }: { playlists: PlaylistSummary[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">PLAYLISTS</p>
          <h2 className="mt-1 text-xl font-semibold">学习路径</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            按目标排列视频，从列表中的下一条继续推进。
          </p>
        </div>
        <Link
          href="/workspace/playlists"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          管理路径
        </Link>
      </div>
      {playlists.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {playlists.map((playlist) => (
            <Link key={playlist.id} href="/workspace/playlists">
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardTitle>{playlist.name}</CardTitle>
                  <CardDescription>
                    {playlist.description || "按顺序完成列表中的学习视频。"}
                  </CardDescription>
                  <CardAction>
                    <Badge variant="secondary">{playlist.videoCount} 个视频</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  {playlist.videos.length > 0 ? (
                    <div className="flex -space-x-2">
                      {playlist.videos.slice(0, 4).map((video) => (
                        <span
                          key={video.id}
                          className="relative size-10 overflow-hidden rounded-full border-2 border-card bg-muted"
                        >
                          <Image
                            src={
                              video.thumbnailUrl ??
                              "/images/linguaflow-course-cover.jpg"
                            }
                            alt=""
                            fill
                            loading="eager"
                            sizes="40px"
                            className="object-cover"
                          />
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">还未添加视频</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    总时长 {formatDuration(playlist.totalDurationSeconds)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Empty className="min-h-52 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListVideoIcon />
            </EmptyMedia>
            <EmptyTitle>还没有学习路径</EmptyTitle>
            <EmptyDescription>
              新建播放列表，再从资源卡片菜单按学习顺序加入视频。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap justify-center gap-2">
              <CreatePlaylistDialog />
              <Link
                href="/workspace/library"
                className={buttonVariants({ variant: "outline" })}
              >
                打开资源库
              </Link>
            </div>
          </EmptyContent>
        </Empty>
      )}
    </section>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Clock3Icon
  label: string
  value: string
  detail: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardAction>
          <span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <strong className="text-xl font-semibold">{value}</strong>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}
