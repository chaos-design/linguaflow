import type { VocabularyMastery } from "../types/learning"

interface ReviewState {
  easeFactor: number
  intervalDays: number
  repetitions: number
}

export interface ReviewSchedule extends ReviewState {
  dueAt: string
  mastery: VocabularyMastery
}

const dayMilliseconds = 24 * 60 * 60 * 1000
export const ebbinghausIntervals = [1, 2, 4, 7, 15, 30, 60, 120, 240, 365]

export function scheduleReview(
  state: ReviewState,
  rating: 1 | 2 | 3 | 4,
  reviewedAt = new Date(),
): ReviewSchedule {
  if (rating === 1) {
    return {
      easeFactor: Math.max(1.3, state.easeFactor - 0.2),
      intervalDays: 0,
      repetitions: 0,
      dueAt: new Date(reviewedAt.getTime() + 10 * 60 * 1000).toISOString(),
      mastery: "new",
    }
  }

  if (rating === 2) {
    return {
      easeFactor: Math.max(1.3, state.easeFactor - 0.15),
      intervalDays: 1,
      repetitions: 0,
      dueAt: addDays(reviewedAt, 1),
      mastery: "learning",
    }
  }

  const repetitions = state.repetitions + 1
  const stage = repetitions + (rating === 4 ? 1 : 0)
  const intervalDays =
    ebbinghausIntervals[Math.min(stage - 1, ebbinghausIntervals.length - 1)] ?? 365
  const easeFactor =
    rating === 4 ? Math.min(3.5, state.easeFactor + 0.05) : state.easeFactor

  return {
    easeFactor,
    intervalDays,
    repetitions: stage,
    dueAt: addDays(reviewedAt, intervalDays),
    mastery: stage >= 7 ? "mastered" : "learning",
  }
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * dayMilliseconds).toISOString()
}
