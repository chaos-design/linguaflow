import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { VocabularyTermHighlight } from "@/components/vocabulary-term-highlight"

describe("VocabularyTermHighlight", () => {
  it("highlights a base form when the headword is plural", () => {
    const html = renderToStaticMarkup(
      createElement(VocabularyTermHighlight, {
        text: "Positive reinforcement encourages learning.",
        word: "reinforcements",
      }),
    )

    expect(html).toContain(">reinforcement</mark>")
    expect(html).toContain("decoration-dotted")
  })

  it("highlights a complete phrase", () => {
    const html = renderToStaticMarkup(
      createElement(VocabularyTermHighlight, {
        text: "positive reinforcement",
        word: "reinforcements",
        highlightPhrase: true,
      }),
    )

    expect(html.match(/<mark/gu)).toHaveLength(1)
    expect(html).toContain(">positive reinforcement</mark>")
  })
})
