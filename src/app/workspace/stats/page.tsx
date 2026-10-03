import { BookCheckIcon, Clock3Icon, FlameIcon, NotebookPenIcon } from "lucide-react"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card"
import { Progress } from "../../../components/ui/progress"
import { LearningCalendar } from "../../../features/stats/learning-calendar"
import { WeeklyActivityChart } from "../../../features/stats/weekly-activity-chart"
import { formatLearningTime } from "../../../lib/format"
import { getOptionalAuthUser } from "../../../server/auth/auth-user"
import {
  getLearningPreferences,
  getLearningStats,
} from "../../../server/learning/queries"

export const metadata: Metadata = {
  title: "学习统计",
  description: "查看学习时长、完成数量、连续学习和分类进度。",
}

export default async function StatsPage() {
  const user = await getOptionalAuthUser()
  if (!user) {
    redirect("/login?next=%2Fworkspace%2Fstats")
  }
  const [stats, preferences] = await Promise.all([
    getLearningStats(user.id),
    getLearningPreferences(user.id),
  ])
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section>
        <p className="text-xs font-medium text-muted-foreground">INSIGHTS</p>
        <h1 className="mt-1 text-2xl font-semibold">学习统计</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          用学习时长、完成率、复习记录和日历观察自己的长期节奏。
        </p>
      </section>

      <section className="grid grid-cols-4 gap-2">
        <MetricCard
          icon={Clock3Icon}
          label="累计学习"
          value={formatLearningTime(stats.totalLearningSeconds)}
        />
        <MetricCard
          icon={BookCheckIcon}
          label="完成视频"
          value={`${stats.completedVideos} 个`}
        />
        <MetricCard
          icon={NotebookPenIcon}
          label="笔记总数"
          value={`${stats.totalNotes} 条`}
        />
        <MetricCard
          icon={FlameIcon}
          label="当前连续"
          value={`${stats.currentStreakDays} 天`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.75fr)]">
        <WeeklyActivityChart activity={stats.recentActivity} />

        <Card>
          <CardHeader>
            <CardTitle>分类进度</CardTitle>
            <CardDescription>按主题查看已完成的视频比例。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {stats.categoryProgress.map((category) => {
              const percentage =
                category.total > 0 ? (category.completed / category.total) * 100 : 0
              return (
                <div key={category.name} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {category.completed} / {category.total}
                    </span>
                  </div>
                  <Progress value={percentage} />
                </div>
              )
            })}
          </CardContent>
        </Card>
      </section>

      <LearningCalendar
        activity={stats.calendarActivity}
        color={preferences.calendarColor}
      />
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3Icon
  label: string
  value: string
}) {
  return (
    <Card size="sm" className="min-w-0 [--card-spacing:--spacing(2.5)]">
      <CardHeader>
        <CardDescription className="truncate text-xs sm:text-sm">
          {label}
        </CardDescription>
        <CardAction>
          <Icon
            className="hidden size-4 text-muted-foreground sm:block"
            aria-hidden="true"
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <strong className="block truncate text-sm font-semibold sm:text-xl">
          {value}
        </strong>
      </CardContent>
    </Card>
  )
}
