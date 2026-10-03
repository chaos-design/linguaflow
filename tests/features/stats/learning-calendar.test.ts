import { describe, expect, it } from "vitest"
import {
  createCalendarLayout,
  createCalendarRange,
} from "@/features/stats/learning-calendar"

describe("learning calendar range", () => {
  it("starts the rolling range on the current month first day", () => {
    const range = createCalendarRange("rolling", new Date(2026, 7, 18))
    const layout = createCalendarLayout(range, new Map())

    expect(range.startKey).toBe("2026-08-01")
    expect(range.endKey).toBe("2027-07-31")
    expect(range.dates).toHaveLength(365)
    expect(layout.weeks[0]?.cells.slice(0, 6).every((cell) => !cell.activity)).toBe(
      true,
    )
    expect(layout.weeks[0]?.cells[6]?.date).toBe("2026-08-01")
    expect(layout.months.map((month) => month.label)).toEqual([
      "8月",
      "9月",
      "10月",
      "11月",
      "12月",
      "1月",
      "2月",
      "3月",
      "4月",
      "5月",
      "6月",
      "7月",
    ])
  })

  it("includes leap day when the rolling year crosses February 29", () => {
    const range = createCalendarRange("rolling", new Date(2023, 7, 18))

    expect(range.startKey).toBe("2023-08-01")
    expect(range.endKey).toBe("2024-07-31")
    expect(range.dates).toHaveLength(366)
  })

  it("uses the selected calendar year and includes leap day", () => {
    const range = createCalendarRange("2024", new Date(2026, 7, 17))

    expect(range.startKey).toBe("2024-01-01")
    expect(range.endKey).toBe("2024-12-31")
    expect(range.dates).toHaveLength(366)
    expect(
      range.dates.some((date) => date.getMonth() === 1 && date.getDate() === 29),
    ).toBe(true)
  })
})
