import { describe, expect, it } from "vitest"
import { scheduleReview } from "@/lib/sm2"

const reviewedAt = new Date("2026-08-16T08:00:00.000Z")

describe("scheduleReview", () => {
  it("resets a forgotten card and schedules a short retry", () => {
    const result = scheduleReview(
      { easeFactor: 2.5, intervalDays: 6, repetitions: 2 },
      1,
      reviewedAt,
    )

    expect(result).toMatchObject({
      easeFactor: 2.3,
      intervalDays: 0,
      repetitions: 0,
      mastery: "new",
    })
    expect(result.dueAt).toBe("2026-08-16T08:10:00.000Z")
  })

  it("advances remembered cards through the Ebbinghaus intervals", () => {
    const result = scheduleReview(
      { easeFactor: 2.5, intervalDays: 6, repetitions: 2 },
      3,
      reviewedAt,
    )

    expect(result).toMatchObject({
      intervalDays: 4,
      repetitions: 3,
      mastery: "learning",
    })
  })

  it("advances easy cards by two stages", () => {
    const result = scheduleReview(
      { easeFactor: 2.5, intervalDays: 10, repetitions: 3 },
      4,
      reviewedAt,
    )

    expect(result.easeFactor).toBe(2.55)
    expect(result.intervalDays).toBe(15)
    expect(result.repetitions).toBe(5)
    expect(result.mastery).toBe("learning")
  })

  it("promotes cards after the sixty-day stage", () => {
    const result = scheduleReview(
      { easeFactor: 2.5, intervalDays: 30, repetitions: 6 },
      3,
      reviewedAt,
    )

    expect(result.intervalDays).toBe(60)
    expect(result.mastery).toBe("mastered")
  })
})
