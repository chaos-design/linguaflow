import { Card, CardContent, CardHeader } from "./ui/card"
import { Skeleton } from "./ui/skeleton"

const metricKeys = ["one", "two", "three", "four"]
const pairKeys = ["one", "two"]
const videoKeys = ["one", "two", "three", "four"]
const tableRowKeys = ["one", "two", "three", "four", "five"]
const actionKeys = ["primary", "secondary"]
const referenceCardKeys = ["one", "two", "three", "four", "five", "six"]

function PageHeadingSkeleton({ actions = 1 }: { actions?: number }) {
  return (
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="flex shrink-0 gap-2">
        {actionKeys.slice(0, actions).map((key) => (
          <Skeleton key={key} className="h-9 w-28" />
        ))}
      </div>
    </header>
  )
}

function SectionHeadingSkeleton() {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-32" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  )
}

function MetricCardSkeleton() {
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader>
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-3 w-full max-w-36" />
      </CardContent>
    </Card>
  )
}

function MetricStripSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-2">
      {metricKeys.map((key) => (
        <div key={key} className="flex items-center gap-2">
          <Skeleton className="size-4 rounded-full" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-6" />
        </div>
      ))}
      <Skeleton className="h-3 w-64" />
    </div>
  )
}

function VideoCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card
      size="sm"
      className="grid min-w-0 grid-cols-[minmax(108px,0.42fr)_minmax(0,1fr)] gap-0 overflow-hidden py-0 sm:grid-cols-[minmax(132px,0.58fr)_minmax(0,1.42fr)]"
    >
      <Skeleton
        className={compact ? "min-h-36 rounded-none" : "min-h-38 rounded-none"}
      />
      <div className="flex min-w-0 flex-col gap-3 p-3">
        <div className="flex justify-between gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="size-7" />
        </div>
        <Skeleton className="h-5 w-4/5" />
        {!compact ? <Skeleton className="h-3 w-full" /> : null}
        <div className="mt-auto flex flex-col gap-2">
          <Skeleton className="h-2 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-14" />
          </div>
        </div>
      </div>
    </Card>
  )
}

function PanelSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3 w-3/4" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {tableRowKeys.slice(0, rows).map((key) => (
          <div key={key} className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-8 w-20 shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function WorkspaceOverviewSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-8"
      role="status"
      aria-busy="true"
      aria-label="正在加载学习概览"
    >
      <PageHeadingSkeleton actions={2} />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metricKeys.map((key) => (
          <MetricCardSkeleton key={key} />
        ))}
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeadingSkeleton />
        <div className="grid gap-4 md:grid-cols-2">
          {pairKeys.map((key) => (
            <VideoCardSkeleton key={key} compact />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeadingSkeleton />
        <div className="grid gap-4 md:grid-cols-2">
          {pairKeys.map((key) => (
            <PanelSkeleton key={key} rows={1} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeadingSkeleton />
        <div className="grid gap-4 md:grid-cols-2">
          {pairKeys.map((key) => (
            <VideoCardSkeleton key={key} compact />
          ))}
        </div>
      </section>
    </div>
  )
}

export function LibraryPageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-7"
      role="status"
      aria-busy="true"
      aria-label="正在加载视频资源库"
    >
      <PageHeadingSkeleton />
      <MetricStripSkeleton />
      <div className="flex flex-col gap-3 py-3">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-[minmax(180px,1.5fr)_repeat(5,minmax(88px,0.7fr))]">
          <Skeleton className="h-10 sm:col-span-2 md:col-span-1" />
          {tableRowKeys.map((key) => (
            <Skeleton key={key} className="h-10" />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
      <section className="flex flex-col gap-4">
        <SectionHeadingSkeleton />
        <div className="grid gap-3 md:grid-cols-2">
          {videoKeys.map((key) => (
            <VideoCardSkeleton key={key} />
          ))}
        </div>
      </section>
    </div>
  )
}

export function PlaylistsPageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="正在加载播放列表"
    >
      <PageHeadingSkeleton actions={2} />
      <section className="grid gap-4 xl:grid-cols-2">
        {videoKeys.map((key) => (
          <PanelSkeleton key={key} rows={3} />
        ))}
      </section>
    </div>
  )
}

export function ReviewPageSkeleton() {
  return (
    <div
      className="h-full overflow-y-auto"
      role="status"
      aria-busy="true"
      aria-label="正在加载复习闪卡"
    >
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 p-4 md:p-8 lg:p-10">
        <PageHeadingSkeleton />
        <MetricStripSkeleton />
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-36" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {pairKeys.map((key) => (
              <div
                key={key}
                className="flex min-h-44 flex-col rounded-md bg-card p-5 shadow-sm ring-1 ring-border"
              >
                <Skeleton className="size-10" />
                <Skeleton className="mt-5 h-6 w-28" />
                <Skeleton className="mt-2 h-4 w-48 max-w-full" />
                <Skeleton className="mt-auto size-5 self-end" />
              </div>
            ))}
          </div>
        </section>
        <div className="mt-auto flex gap-2">
          {metricKeys.slice(0, 3).map((key) => (
            <Skeleton key={key} className="h-3 w-24" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SettingsPageSkeleton() {
  const sections = [
    { key: "general", rows: 3 },
    { key: "captions", rows: 2 },
    { key: "learning", rows: 3 },
    { key: "dictionary", rows: 2 },
    { key: "video", rows: 2 },
    { key: "data", rows: 3 },
  ]

  return (
    <div
      className="mx-auto flex w-full max-w-4xl flex-col gap-8"
      role="status"
      aria-busy="true"
      aria-label="正在加载设置"
    >
      <PageHeadingSkeleton actions={0} />
      <PanelSkeleton rows={1} />
      {sections.map((section) => (
        <section key={section.key} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-64" />
          <PanelSkeleton rows={section.rows} />
        </section>
      ))}
    </div>
  )
}

export function StatsPageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="正在加载学习统计"
    >
      <PageHeadingSkeleton actions={0} />
      <section className="grid grid-cols-4 gap-2">
        {metricKeys.map((key) => (
          <MetricCardSkeleton key={key} />
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.75fr)]">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
        <PanelSkeleton rows={4} />
      </section>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export function VocabularyPageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-4"
      role="status"
      aria-busy="true"
      aria-label="正在加载生词本"
    >
      <PageHeadingSkeleton />
      <MetricStripSkeleton />
      <div className="flex gap-2">
        <Skeleton className="h-9 min-w-0 flex-1" />
        <Skeleton className="h-9 w-24" />
      </div>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-[1fr_1.8fr_1.2fr_0.6fr_0.8fr] gap-4 border-b p-4">
            {tableRowKeys.map((key) => (
              <Skeleton key={key} className="h-4" />
            ))}
          </div>
          {tableRowKeys.map((key) => (
            <div
              key={key}
              className="grid grid-cols-[1fr_1.8fr_1.2fr_0.6fr_0.8fr] gap-4 border-b p-4 last:border-b-0"
            >
              <Skeleton className="h-5" />
              <Skeleton className="h-8" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-8" />
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}

export function ImportPageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1500px] flex-col gap-8"
      role="status"
      aria-busy="true"
      aria-label="正在加载导入视频"
    >
      <PageHeadingSkeleton actions={2} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-3/4" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-20" />
              </div>
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-px w-full" />
              <Skeleton className="h-6 w-3/5" />
            </CardContent>
          </Card>
          <PanelSkeleton rows={3} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <PanelSkeleton rows={2} />
          <PanelSkeleton rows={4} />
          <PanelSkeleton rows={4} />
        </div>
      </div>
    </div>
  )
}

export function BatchImportPageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1500px] flex-col gap-8"
      role="status"
      aria-busy="true"
      aria-label="正在加载批量导入"
    >
      <PageHeadingSkeleton actions={2} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.7fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-64" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-44 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-8 w-28" />
              </div>
            </CardContent>
          </Card>
          <PanelSkeleton rows={4} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <PanelSkeleton rows={2} />
          <Skeleton className="h-24 w-full" />
          <PanelSkeleton rows={4} />
        </div>
      </div>
      <Skeleton className="sticky bottom-0 h-16 w-full rounded-t-md" />
    </div>
  )
}

export function VideoPlayerSkeleton() {
  return (
    <div
      className="grid h-full min-h-0 grid-rows-[350px_4px_minmax(0,1fr)] overflow-hidden bg-card lg:grid-cols-[minmax(480px,1fr)_4px_minmax(380px,32%)] lg:grid-rows-1"
      role="status"
      aria-busy="true"
      aria-label="正在加载视频学习页"
    >
      <section className="flex min-h-0 min-w-0 flex-col">
        <Skeleton className="min-h-0 flex-1 rounded-none bg-foreground/90" />
        <div className="flex shrink-0 items-center gap-4 bg-card px-4 py-3 shadow-sm">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      </section>
      <Skeleton className="size-full rounded-none bg-muted-foreground/35" />
      <aside className="flex min-h-0 min-w-0 flex-col bg-card">
        <div className="grid h-16 shrink-0 grid-cols-3 gap-4 bg-card px-4 pt-4 shadow-sm">
          {["transcript", "notes", "details"].map((key) => (
            <Skeleton key={key} className="h-9 w-full" />
          ))}
        </div>
        <div className="flex shrink-0 gap-2 p-3 shadow-sm">
          <Skeleton className="h-9 min-w-0 flex-1" />
          {["translation", "locate", "upload", "follow"].map((key) => (
            <Skeleton key={key} className="size-9" />
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
          {tableRowKeys.map((key, index) => (
            <div key={key} className="flex items-start gap-3 rounded-md p-2">
              <Skeleton className="h-3 w-10 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className={index % 2 === 0 ? "h-4 w-full" : "h-4 w-4/5"} />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}

export function ReferencePageSkeleton({
  variant,
}: {
  variant: "architecture" | "colors" | "states"
}) {
  const cardCount = variant === "architecture" ? 3 : variant === "colors" ? 6 : 2

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-12 pb-8"
      role="status"
      aria-busy="true"
      aria-label="正在加载参考页面"
    >
      <PageHeadingSkeleton actions={2} />
      <section className="flex flex-col gap-4">
        <SectionHeadingSkeleton />
        <div
          className={
            variant === "architecture"
              ? "grid gap-4 md:grid-cols-3"
              : variant === "colors"
                ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                : "grid gap-4 md:grid-cols-2"
          }
        >
          {referenceCardKeys.slice(0, cardCount).map((key) => (
            <PanelSkeleton key={key} rows={variant === "states" ? 3 : 1} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeadingSkeleton />
        <Skeleton className="h-64 w-full" />
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeadingSkeleton />
        <div className="grid gap-4 md:grid-cols-2">
          {pairKeys.map((key) => (
            <PanelSkeleton key={key} rows={3} />
          ))}
        </div>
      </section>
    </div>
  )
}
