import { describe, expect, it } from "vitest"
import {
  getVocabularyBaseWordCandidates,
  getVocabularyWordForms,
} from "@/lib/vocabulary-word-forms"

describe("vocabulary word forms", () => {
  it("derives base words from plurals and regular verb forms", () => {
    expect(getVocabularyBaseWordCandidates("reinforcements")).toContain("reinforcement")
    expect(getVocabularyBaseWordCandidates("studies")).toContain("study")
    expect(getVocabularyBaseWordCandidates("running")).toContain("run")
  })

  it("links common irregular forms to their base words", () => {
    expect(Array.from(getVocabularyWordForms("went"))).toEqual(
      expect.arrayContaining(["go", "goes", "going", "gone", "went"]),
    )
    expect(Array.from(getVocabularyWordForms("ran"))).toEqual(
      expect.arrayContaining(["run", "runs", "running", "ran"]),
    )
  })

  it("includes supplied dictionary inflections", () => {
    const forms = getVocabularyWordForms("reinforcements", ["reinforcement"])

    expect(forms.has("reinforcement")).toBe(true)
    expect(forms.has("reinforcements")).toBe(true)
  })
})
