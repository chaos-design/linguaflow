import { describe, expect, it } from "vitest"
import {
  type EnglishSpeechVoice,
  selectEnglishSpeechVoice,
} from "../../src/lib/english-speech"

function createVoice(
  name: string,
  lang: string,
  isDefault = false,
): EnglishSpeechVoice {
  return {
    default: isDefault,
    lang,
    localService: true,
    name,
    voiceURI: name,
  }
}

describe("selectEnglishSpeechVoice", () => {
  it("selects distinct preferred voices for British and American English", () => {
    const voices = [
      createVoice("System Default", "en-US", true),
      createVoice("Google UK English Female", "en-GB"),
      createVoice("Google US English", "en-US"),
    ]

    expect(selectEnglishSpeechVoice(voices, "uk")?.name).toBe(
      "Google UK English Female",
    )
    expect(selectEnglishSpeechVoice(voices, "us")?.name).toBe("Google US English")
  })

  it("normalizes underscore locale separators", () => {
    const voice = createVoice("Serena", "en_GB")

    expect(selectEnglishSpeechVoice([voice], "uk")).toBe(voice)
  })

  it("prefers a non-default matching voice when no named voice is available", () => {
    const defaultVoice = createVoice("Default US Voice", "en-US", true)
    const alternateVoice = createVoice("Alternate US Voice", "en-US")

    expect(selectEnglishSpeechVoice([defaultVoice, alternateVoice], "us")).toBe(
      alternateVoice,
    )
  })

  it("does not substitute another regional accent", () => {
    expect(
      selectEnglishSpeechVoice([createVoice("Australian Voice", "en-AU")], "uk"),
    ).toBeNull()
  })
})
