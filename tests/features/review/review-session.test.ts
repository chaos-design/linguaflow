import { describe, expect, it } from "vitest"
import {
  buildReviewChoiceOptions,
  buildReviewQueue,
  clampReviewTarget,
  createClozePrompt,
  createReviewClozePrompt,
  getClozeReviewExamples,
  getContextReviewExamples,
  getEligibleReviewCards,
  getExampleReviewPhrases,
  getReviewExamples,
  isVocabularyPhrase,
  requeueReviewCard,
  restoreDueReviewCard,
  updateReviewedCard,
} from "../../../src/features/review/review-session"
import type { VocabularyWord } from "../../../src/types/learning"

function makeCard(
  id: string,
  mastery: VocabularyWord["mastery"],
  dueAt: string,
): VocabularyWord {
  return {
    id,
    word: id,
    tags: [],
    phonetic: "",
    phoneticUk: "",
    phoneticUs: "",
    partOfSpeech: "",
    definition: `${id} definition`,
    definitionTranslation: "",
    meanings: [],
    examLabels: [],
    inflections: [],
    examples: [],
    exampleTranslations: [],
    commonPhrases: [],
    wordAnalysis: {
      etymology: "",
      etymologyTranslation: "",
      examLabels: [],
      inflections: [],
      parts: [],
      relatedWords: [],
    },
    dictionarySources: [],
    aiAnalysis: null,
    sourceTitle: "Test video",
    sourceVideoId: null,
    sourceTimestampSeconds: 0,
    sourceSentence: "",
    translation: "",
    addedAt: dueAt,
    mastery,
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueAt,
    lastReviewedAt: null,
  }
}

const cards = [
  makeCard("later", "learning", "2026-08-20T10:00:00.000Z"),
  makeCard("new", "new", "2026-08-20T08:00:00.000Z"),
  makeCard("earlier", "learning", "2026-08-20T09:00:00.000Z"),
]

describe("review session planning", () => {
  it("filters cards by the selected mastery focus", () => {
    expect(getEligibleReviewCards(cards, "learning").map((card) => card.id)).toEqual([
      "later",
      "earlier",
    ])
  })

  it("filters cards that match any selected tag", () => {
    const taggedCards = [
      {
        ...cards[0],
        tags: [{ id: "work", name: "商务", isDefault: false }],
      },
      {
        ...cards[1],
        tags: [{ id: "travel", name: "旅行", isDefault: false }],
      },
      {
        ...cards[2],
        tags: [
          { id: "work", name: "商务", isDefault: false },
          { id: "exam", name: "考试", isDefault: false },
        ],
      },
    ] as VocabularyWord[]

    expect(
      getEligibleReviewCards(taggedCards, "all", ["travel", "exam"]).map(
        (card) => card.id,
      ),
    ).toEqual(["new", "earlier"])
    expect(
      getEligibleReviewCards(taggedCards, "learning", ["work"]).map((card) => card.id),
    ).toEqual(["later", "earlier"])
  })

  it("orders due cards before applying the target limit", () => {
    const queue = buildReviewQueue(
      cards,
      { focus: "all", order: "due-first", tagIds: [], targetCount: 2 },
      1,
    )

    expect(queue.map((card) => card.id)).toEqual(["new", "earlier"])
  })

  it("creates a stable random queue without mutating the source list", () => {
    const originalOrder = cards.map((card) => card.id)
    const plan = {
      focus: "all",
      order: "random",
      tagIds: [],
      targetCount: 3,
    } as const

    expect(buildReviewQueue(cards, plan, 42)).toEqual(buildReviewQueue(cards, plan, 42))
    expect(cards.map((card) => card.id)).toEqual(originalOrder)
  })

  it("clamps target counts to the available queue", () => {
    expect(clampReviewTarget(0, 5)).toBe(1)
    expect(clampReviewTarget(20, 5)).toBe(5)
    expect(clampReviewTarget(20, 0)).toBe(0)
  })

  it("applies the persisted review progress to the matching card", () => {
    const updated = updateReviewedCard(cards, "new", {
      dueAt: "2026-08-22T08:00:00.000Z",
      easeFactor: 2.55,
      intervalDays: 2,
      lastReviewedAt: "2026-08-20T08:00:00.000Z",
      mastery: "learning",
      repetitions: 2,
    })

    expect(updated.find((card) => card.id === "new")).toMatchObject({
      dueAt: "2026-08-22T08:00:00.000Z",
      easeFactor: 2.55,
      intervalDays: 2,
      lastReviewedAt: "2026-08-20T08:00:00.000Z",
      mastery: "learning",
      repetitions: 2,
    })
    expect(cards.find((card) => card.id === "new")?.mastery).toBe("new")
  })

  it("moves a failed review card to the end of the current session", () => {
    expect(requeueReviewCard(cards, "new").map((card) => card.id)).toEqual([
      "later",
      "earlier",
      "new",
    ])
    expect(requeueReviewCard(cards, "missing")).toBe(cards)
  })

  it("restores a failed card to the due queue without duplicates", () => {
    const activeCards = cards.filter((card) => card.id !== "new")
    const restored = restoreDueReviewCard(activeCards, cards[1] as VocabularyWord)

    expect(restored.map((card) => card.id)).toEqual(["new", "earlier", "later"])
    expect(restoreDueReviewCard(restored, cards[1] as VocabularyWord)).toBe(restored)
  })
})

describe("review context examples", () => {
  it("uses the vocabulary example and its translation for cloze review", () => {
    const card = {
      ...makeCard("consider", "new", "2026-08-20T08:00:00.000Z"),
      sourceSentence: "The complete sentence from the video.",
      examples: ["We should consider every option."],
      exampleTranslations: [
        {
          text: "We should consider every option.",
          translation: "我们应该考虑每一种选择。",
        },
      ],
    }

    expect(getReviewExamples(card)).toEqual(card.exampleTranslations)
    expect(getClozeReviewExamples(card)).toEqual(card.exampleTranslations)
    expect(createClozePrompt(card.exampleTranslations[0]?.text ?? "", card.word)).toBe(
      "We should _____ every option.",
    )
  })

  it("falls back to untranslated examples and rejects sentences without the word", () => {
    const card = {
      ...makeCard("consider", "new", "2026-08-20T08:00:00.000Z"),
      examples: ["Please consider the proposal.", "We weighed every option."],
    }

    expect(getReviewExamples(card)).toEqual([
      { text: "Please consider the proposal.", translation: "" },
      { text: "We weighed every option.", translation: "" },
    ])
    expect(getClozeReviewExamples(card)).toEqual([
      { text: "Please consider the proposal.", translation: "" },
    ])
    expect(createClozePrompt("We weighed every option.", card.word)).toBe("_____")
  })

  it("uses a phrase's own example and handles an inflected first word", () => {
    const card = {
      ...makeCard("take place", "new", "2026-08-20T08:00:00.000Z"),
      partOfSpeech: "phrase",
      exampleTranslations: [
        {
          text: "No one was sure why it took place there.",
          translation: "没有人知道它为什么在那里发生。",
        },
      ],
    }

    expect(isVocabularyPhrase(card)).toBe(true)
    expect(getContextReviewExamples(card)).toEqual(card.exampleTranslations)
    expect(
      createReviewClozePrompt(card.exampleTranslations[0]?.text ?? "", card.word),
    ).toBe("No one was sure why it _____ there.")
  })

  it("keeps only common phrases that have their own example", () => {
    const card = {
      ...makeCard("take", "new", "2026-08-20T08:00:00.000Z"),
      commonPhrases: [
        {
          text: "take place",
          translation: "发生",
          note: "",
          example: "The meeting took place yesterday.",
          exampleTranslation: "会议昨天举行了。",
        },
        {
          text: "take over",
          translation: "接管",
          note: "",
          example: "",
          exampleTranslation: "",
        },
      ],
    }

    expect(getExampleReviewPhrases(card).map((phrase) => phrase.text)).toEqual([
      "take place",
    ])
  })
})

describe("review choices", () => {
  it("creates stable unique choices and keeps distractor translations", () => {
    const correctOption = {
      id: "consider",
      text: "consider",
      translation: "考虑",
    }
    const candidates = [
      correctOption,
      { id: "compare", text: "compare", translation: "比较" },
      { id: "compare-copy", text: " Compare ", translation: "对比" },
      { id: "continue", text: "continue", translation: "继续" },
      { id: "empty", text: "conceive", translation: "" },
      { id: "complete", text: "complete", translation: "完成" },
    ]

    const choices = buildReviewChoiceOptions(correctOption, candidates, 42)

    expect(choices).toEqual(buildReviewChoiceOptions(correctOption, candidates, 42))
    expect(choices).toHaveLength(4)
    expect(choices.filter((choice) => choice.id === correctOption.id)).toHaveLength(1)
    expect(
      choices
        .filter((choice) => choice.id !== correctOption.id)
        .every((choice) => choice.translation.length > 0),
    ).toBe(true)
    expect(
      new Set(choices.map((choice) => choice.text.trim().toLocaleLowerCase("en"))).size,
    ).toBe(choices.length)
  })
})
