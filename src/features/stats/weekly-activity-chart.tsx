"use client"

import { BarChart3Icon, ChartSplineIcon } from "lucide-react"
import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../../components/ui/chart"
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { formatLearningTime } from "../../lib/format"
import type { DailyActivity } from "../../types/learning"

const chartConfig = {
  minutes: {
    label: "学习分钟",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

type ChartMode = "bar" | "line"
type ChartRange = 7 | 15 | 30

const chartRanges: ChartRange[] = [7, 15, 30]

export function WeeklyActivityChart({ activity }: { activity: DailyActivity[] }) {
  const [mode, setMode] = useState<ChartMode>("line")
  const [range, setRange] = useState<ChartRange>(7)
  const visibleActivity = activity.slice(-range)
  const totalSeconds = visibleActivity.reduce((total, day) => total + day.seconds, 0)
  const chartData = visibleActivity.map((day) => ({
    date: day.date,
    day: day.label,
    shortDate: day.date.slice(5).replace("-", "/"),
    minutes: Math.round(day.seconds / 60),
  }))

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>学习趋势</CardTitle>
        <CardDescription>
          最近 {range} 天累计 {formatLearningTime(totalSeconds)}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <ToggleGroup
            value={[String(range)]}
            onValueChange={(value) => {
              const nextRange = Number(value[0])
              if (chartRanges.includes(nextRange as ChartRange)) {
                setRange(nextRange as ChartRange)
              }
            }}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="选择学习趋势时间范围"
          >
            {chartRanges.map((dayCount) => (
              <ToggleGroupItem key={dayCount} value={String(dayCount)}>
                {dayCount}天
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            value={[mode]}
            onValueChange={(value) => {
              const nextMode = value[0]
              if (nextMode === "bar" || nextMode === "line") {
                setMode(nextMode)
              }
            }}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="切换学习趋势图表类型"
          >
            <Tooltip>
              <TooltipTrigger
                render={<ToggleGroupItem value="bar" aria-label="显示柱状图" />}
              >
                <BarChart3Icon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>柱状图</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={<ToggleGroupItem value="line" aria-label="显示折线图" />}
              >
                <ChartSplineIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>折线图</TooltipContent>
            </Tooltip>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="h-56 min-h-56 w-full aspect-auto"
        >
          {mode === "bar" ? (
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 8, right: 8, top: 8 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey={range === 7 ? "day" : "shortDate"}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={18}
              />
              <YAxis hide domain={[0, "auto"]} />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", fillOpacity: 0.45 }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => payload[0]?.payload.date ?? ""}
                  />
                }
              />
              <Bar
                dataKey="minutes"
                fill="var(--color-minutes)"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          ) : (
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 8, right: 8, top: 8 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey={range === 7 ? "day" : "shortDate"}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={18}
              />
              <YAxis hide domain={[0, "auto"]} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(_, payload) => payload[0]?.payload.date ?? ""}
                  />
                }
              />
              <Line
                dataKey="minutes"
                type="monotone"
                stroke="var(--color-minutes)"
                strokeWidth={2}
                dot={{ fill: "var(--color-minutes)", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
