"use client"

import { CalendarDaysIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { formatLearningTime } from "../../lib/format"
import { cn } from "../../lib/utils"
import type { DailyActivity } from "../../types/learning"

const dayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
const activityLevelPercentages = [0, 28, 50, 72, 100]

interface CalendarCell {
  date: string
  activity: DailyActivity | null
}

interface CalendarWeek {
  key: string
  cells: CalendarCell[]
}

interface CalendarMonth {
  key: string
  label: string
  startWeek: number
  weekSpan: number
}

interface CalendarRange {
  start: Date
  end: Date
  startKey: string
  endKey: string
  dates: Date[]
}

interface CalendarLayout {
  weeks: CalendarWeek[]
  months: CalendarMonth[]
}

export function LearningCalendar({
  activity,
  color,
}: {
  activity: DailyActivity[]
  color: string
}) {
  const [now, setNow] = useState(() => new Date())
  const [rangeValue, setRangeValue] = useState("rolling")
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()))
  const activityMap = useMemo(
    () => new Map(activity.map((day) => [day.date, day])),
    [activity],
  )
  const range = useMemo(() => createCalendarRange(rangeValue, now), [rangeValue, now])
  const layout = useMemo(
    () => createCalendarLayout(range, activityMap),
    [activityMap, range],
  )
  const displayedActivity = useMemo(
    () => range.dates.map((date) => getDailyActivity(formatDateKey(date), activityMap)),
    [activityMap, range],
  )
  const maximumScore = Math.max(
    1,
    ...displayedActivity.map((day) => getActivityScore(day)),
  )
  const activeDays = displayedActivity.filter((day) => getActivityScore(day) > 0).length
  const selectedActivity = getDailyActivity(selectedDate, activityMap)
  const yearItems = createYearItems(activity, now.getFullYear())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (selectedDate < range.startKey || selectedDate > range.endKey) {
      setSelectedDate(range.startKey)
    }
  }, [range.endKey, range.startKey, selectedDate])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDaysIcon className="size-4 text-muted-foreground" />
          学习日历
        </CardTitle>
        <CardDescription>
          {formatCalendarRange(range)} · 活跃 {activeDays} 天
        </CardDescription>
        <CardAction>
          <Select
            items={yearItems}
            value={rangeValue}
            onValueChange={(value) => setRangeValue(value ?? "rolling")}
          >
            <SelectTrigger className="w-20" aria-label="选择日历年份">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {yearItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <div
          className="grid min-w-0 gap-x-3 gap-y-1"
          style={{ gridTemplateColumns: "2.25rem minmax(0, 1fr)" }}
        >
          <span className="col-start-1 row-start-1" aria-hidden="true" />
          <div
            className="col-start-2 row-start-1 grid min-w-0 gap-1"
            style={{
              gridTemplateColumns: `repeat(${layout.weeks.length}, minmax(0, 1fr))`,
            }}
            aria-hidden="true"
          >
            {layout.months.map((month) => (
              <span
                key={month.key}
                className="truncate pb-1 text-[10px] leading-4 text-muted-foreground"
                style={{
                  gridColumn: `${month.startWeek + 1} / span ${month.weekSpan}`,
                }}
              >
                {month.label}
              </span>
            ))}
          </div>

          <div
            className="col-start-1 row-start-2 grid grid-rows-7 gap-1"
            aria-hidden="true"
          >
            {dayLabels.map((label) => (
              <span
                key={label}
                className="flex min-h-0 items-center justify-start text-[10px] text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>

          <fieldset
            className="col-start-2 row-start-2 m-0 grid min-w-0 gap-1 border-0 p-0"
            style={{
              gridTemplateColumns: `repeat(${layout.weeks.length}, minmax(0, 1fr))`,
            }}
            aria-label="学习活跃度日历，周日为每周第一天"
          >
            {layout.weeks.map((week) => (
              <div key={week.key} className="grid min-w-0 grid-rows-7 gap-1">
                {week.cells.map((cell) =>
                  cell.activity ? (
                    <ActivityCell
                      key={cell.date}
                      day={cell.activity}
                      color={color}
                      level={getActivityLevel(cell.activity, maximumScore)}
                      selected={selectedDate === cell.date}
                      onSelect={setSelectedDate}
                    />
                  ) : (
                    <span
                      key={cell.date}
                      className="aspect-square w-full min-w-0"
                      aria-hidden="true"
                    />
                  ),
                )}
              </div>
            ))}
          </fieldset>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {range.dates.length} 天 · {activeDays} 个学习日
          </span>
          <div
            className="flex items-center gap-1.5"
            role="img"
            aria-label="活跃度从少到多"
          >
            <span>少</span>
            {activityLevelPercentages.map((percentage, level) => (
              <span
                key={`legend-${percentage}`}
                className={cn(
                  "size-3.5 rounded-sm",
                  level === 0 && "bg-muted/55 ring-1 ring-inset ring-border/60",
                )}
                style={getActivityLevelStyle(color, level)}
              />
            ))}
            <span>多</span>
          </div>
        </div>

        <div className="grid gap-3 border-t pt-4 sm:grid-cols-4">
          <CalendarMetric
            label="日期"
            value={formatCalendarDate(selectedActivity.date)}
          />
          <CalendarMetric
            label="学习时长"
            value={formatLearningTime(selectedActivity.seconds)}
          />
          <CalendarMetric
            label="学习活动"
            value={`${selectedActivity.sessionCount} 次`}
          />
          <CalendarMetric
            label="复习 / 笔记"
            value={`${selectedActivity.reviewCount} / ${selectedActivity.noteCount}`}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityCell({
  day,
  color,
  level,
  selected,
  onSelect,
}: {
  day: DailyActivity
  color: string
  level: number
  selected: boolean
  onSelect: (date: string) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`${day.date}，学习 ${formatLearningTime(day.seconds)}，复习 ${day.reviewCount} 次，笔记 ${day.noteCount} 条`}
            aria-pressed={selected}
            className={cn(
              "aspect-square w-full min-w-0 rounded-sm outline-none ring-offset-1 ring-offset-background transition-transform hover:z-10 hover:scale-125 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
              level === 0 &&
                "bg-muted/55 ring-1 ring-inset ring-border/60 hover:bg-muted",
              selected && "ring-2 ring-foreground",
            )}
            style={getActivityLevelStyle(color, level)}
            onClick={() => onSelect(day.date)}
          />
        }
      />
      <TooltipContent className="flex-col items-start gap-0.5 px-3 py-2">
        <p className="font-medium">{formatCalendarDate(day.date)}</p>
        <p>
          {formatLearningTime(day.seconds)} · {day.sessionCount} 次学习 ·{" "}
          {day.reviewCount} 次复习 · {day.noteCount} 条笔记
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

function CalendarMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

export function createCalendarRange(value: string, now: Date): CalendarRange {
  const selectedYear = Number(value)
  const start =
    value === "rolling" || !Number.isInteger(selectedYear)
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(selectedYear, 0, 1)
  const endExclusive =
    value === "rolling" || !Number.isInteger(selectedYear)
      ? new Date(start.getFullYear() + 1, start.getMonth(), 1)
      : new Date(selectedYear + 1, 0, 1)
  const dates: Date[] = []
  const cursor = new Date(start)

  while (cursor < endExclusive) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  const end = dates.at(-1) ?? start
  return {
    start,
    end,
    startKey: formatDateKey(start),
    endKey: formatDateKey(end),
    dates,
  }
}

export function createCalendarLayout(
  range: CalendarRange,
  activityMap: Map<string, DailyActivity>,
): CalendarLayout {
  const leadingEmptyCells = range.start.getDay()
  const cells: CalendarCell[] = Array.from(
    { length: leadingEmptyCells },
    (_, index) => ({
      date: `leading-empty-${index}`,
      activity: null,
    }),
  )

  for (const date of range.dates) {
    const dateKey = formatDateKey(date)
    cells.push({
      date: dateKey,
      activity: getDailyActivity(dateKey, activityMap),
    })
  }

  const weeks: CalendarWeek[] = []
  for (let offset = 0; offset < cells.length; offset += 7) {
    const weekCells = cells.slice(offset, offset + 7)
    weeks.push({
      key:
        weekCells.find((cell) => cell.activity)?.date ??
        weekCells[0]?.date ??
        `week-${offset / 7}`,
      cells: weekCells,
    })
  }

  const monthStarts = range.dates.flatMap((date, index) => {
    if (index !== 0 && date.getDate() !== 1) {
      return []
    }
    return [
      {
        key: `${date.getFullYear()}-${date.getMonth() + 1}`,
        label: `${date.getMonth() + 1}月`,
        startWeek: Math.floor((leadingEmptyCells + index) / 7),
      },
    ]
  })
  const months = monthStarts.map((month, index) => {
    const nextMonth = monthStarts[index + 1]
    return {
      ...month,
      weekSpan: Math.max(1, (nextMonth?.startWeek ?? weeks.length) - month.startWeek),
    }
  })

  return { weeks, months }
}

function createYearItems(activity: DailyActivity[], currentYear: number) {
  const activityYears = activity.map((day) => Number(day.date.slice(0, 4)))
  const minimumYear = Math.min(currentYear - 4, ...activityYears)
  const maximumYear = Math.max(currentYear, ...activityYears)
  const years = Array.from(
    { length: maximumYear - minimumYear + 1 },
    (_, index) => maximumYear - index,
  )

  return [
    { label: String(currentYear), value: "rolling" },
    ...years
      .filter((year) => year !== currentYear)
      .map((year) => ({ label: String(year), value: String(year) })),
  ]
}

function getDailyActivity(
  date: string,
  activityMap: Map<string, DailyActivity>,
): DailyActivity {
  return (
    activityMap.get(date) ?? {
      date,
      label: new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(
        parseCalendarDate(date),
      ),
      seconds: 0,
      sessionCount: 0,
      reviewCount: 0,
      noteCount: 0,
    }
  )
}

function getActivityScore(day: DailyActivity): number {
  return (
    day.seconds + day.sessionCount * 60 + day.reviewCount * 300 + day.noteCount * 180
  )
}

function getActivityLevel(day: DailyActivity, maximumScore: number): number {
  const score = getActivityScore(day)
  if (score === 0) {
    return 0
  }
  return Math.min(4, Math.max(1, Math.ceil((score / maximumScore) * 4)))
}

function getActivityLevelStyle(color: string, level: number) {
  if (level === 0) {
    return {
      backgroundColor: `color-mix(in oklab, ${color} 9%, var(--background))`,
      boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 18%, var(--border))`,
    }
  }
  const percentage = activityLevelPercentages[level] ?? 100
  return {
    backgroundColor: `color-mix(in oklab, ${color} ${percentage}%, var(--background))`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 35%, transparent)`,
  }
}

function parseCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function formatDateKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatCalendarDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(parseCalendarDate(value))
}

function formatCalendarRange(range: CalendarRange): string {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  })
  return `${formatter.format(range.start)} - ${formatter.format(range.end)}`
}
