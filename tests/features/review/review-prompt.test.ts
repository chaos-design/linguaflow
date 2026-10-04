import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ClozePromptText } from "@/features/review/review-workspace"

describe("ClozePromptText", () => {
  it("keeps the blank hidden before answering", () => {
    const html = renderToStaticMarkup(
      createElement(ClozePromptText, {
        prompt: "We should _____ every option.",
        revealedAnswer: null,
      }),
    )

    expect(html).toContain("_____")
    expect(html).not.toContain("<mark")
  })

  it("fills the blank with the correct answer after answering", () => {
    const html = renderToStaticMarkup(
      createElement(ClozePromptText, {
        prompt: "We should _____ every option.",
        revealedAnswer: "consider",
      }),
    )

    expect(html).toContain(">consider</mark>")
    expect(html).toContain("decoration-success")
    expect(html).not.toContain("_____")
  })

  it("preserves the sentence around a filled blank", () => {
    const html = renderToStaticMarkup(
      createElement(ClozePromptText, {
        prompt: "We should _____ every option.",
        revealedAnswer: "consider",
      }),
    )

    expect(html).toContain("We should ")
    expect(html).toContain(" every option.")
  })

  it("fills every blank when a sentence has more than one", () => {
    const html = renderToStaticMarkup(
      createElement(ClozePromptText, {
        prompt: "_____ will _____ it.",
        revealedAnswer: "He",
      }),
    )

    expect(html.match(/<mark/gu)).toHaveLength(2)
    expect(html).not.toContain("_____")
  })

  it("renders an untouched sentence when there is no blank", () => {
    const html = renderToStaticMarkup(
      createElement(ClozePromptText, {
        prompt: "We weighed every option.",
        revealedAnswer: "consider",
      }),
    )

    expect(html).toBe("We weighed every option.")
    expect(html).not.toContain("<mark")
  })
})
