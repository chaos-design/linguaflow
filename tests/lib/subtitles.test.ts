import { describe, expect, it } from "vitest"
import {
  compareSubtitleCues,
  formatSubtitleTimestamp,
  getSubtitleSentenceContext,
  groupSubtitleCuesBySentence,
  parseBilibiliTranscript,
  parseSubtitleDocument,
  parseSubtitleFile,
  parseYouTubeTranscript,
  placeSubtitleTranslationsAtSentenceStart,
  selectSubtitleSentenceCueIds,
  subtitleCuesToVtt,
} from "@/lib/subtitles"

describe("parseSubtitleFile", () => {
  it("parses bilingual SRT cues", () => {
    const cues = parseSubtitleFile(`1
00:00:01,250 --> 00:00:03,500
The model converges.
模型逐渐收敛。

2
00:04,000 --> 00:06,000
<i>Gradient descent</i> updates the parameters.`)

    expect(cues).toEqual([
      {
        startSeconds: 1.25,
        endSeconds: 3.5,
        text: "The model converges.",
        translation: "模型逐渐收敛。",
      },
      {
        startSeconds: 4,
        endSeconds: 6,
        text: "Gradient descent updates the parameters.",
        translation: "",
      },
    ])
  })

  it("parses WebVTT identifiers and settings", () => {
    const cues = parseSubtitleFile(`WEBVTT

intro
00:00:07.000 --> 00:00:09.100 align:start position:10%
Optimization starts here.`)

    expect(cues).toHaveLength(1)
    expect(cues[0]).toMatchObject({
      startSeconds: 7,
      endSeconds: 9.1,
      text: "Optimization starts here.",
    })
  })

  it("removes leading speaker markers from subtitle lines", () => {
    const cues = parseSubtitleFile(`1
00:00:01,000 --> 00:00:02,000
>> Speaker: Welcome back.

2
00:00:03,000 --> 00:00:04,000
&gt;&gt; Keep >> going.`)

    expect(cues.map((cue) => cue.text)).toEqual([
      "Speaker: Welcome back.",
      "Keep going.",
    ])
  })

  it("ignores invalid blocks", () => {
    expect(parseSubtitleFile("WEBVTT\n\nNOTE generated automatically")).toEqual([])
  })

  it("parses copied time, subtitle, and machine-translation tables", () => {
    const result = parseSubtitleDocument(`Time\tSubtitle\tMachine Translation
5s\tToday, we are going to move to a sequence of lectures\t今天，我们将开始一系列讲座
9s\ton large language models.\t关于大型语言模型。
11s\tNot many, probably 3, 4.\t不多，大概三四个吧。
13s\tAnd in between, we also have to talk about reinforcement\t而且，我们还要谈谈强化学习`)

    expect(result.format).toBe("tabular")
    expect(result.cues).toEqual([
      {
        startSeconds: 5,
        endSeconds: 9,
        text: "Today, we are going to move to a sequence of lectures",
        translation: "今天，我们将开始一系列讲座",
      },
      {
        startSeconds: 9,
        endSeconds: 11,
        text: "on large language models.",
        translation: "关于大型语言模型。",
      },
      {
        startSeconds: 11,
        endSeconds: 13,
        text: "Not many, probably 3, 4.",
        translation: "不多，大概三四个吧。",
      },
      {
        startSeconds: 13,
        endSeconds: 15,
        text: "And in between, we also have to talk about reinforcement",
        translation: "而且，我们还要谈谈强化学习",
      },
    ])
  })

  it("parses tables copied as a vertical sequence of cells", () => {
    const result = parseSubtitleDocument(`Time
Subtitle
Machine Translation
5s
First line.
第一行。
9s
Second line.
第二行。`)

    expect(result.format).toBe("tabular")
    expect(result.cues).toEqual([
      {
        startSeconds: 5,
        endSeconds: 9,
        text: "First line.",
        translation: "第一行。",
      },
      {
        startSeconds: 9,
        endSeconds: 13,
        text: "Second line.",
        translation: "第二行。",
      },
    ])
  })

  it("parses Markdown subtitle tables with explicit time ranges", () => {
    const result = parseSubtitleDocument(`| Time | Subtitle | Translation |
| --- | --- | --- |
| 00:01 --> 00:03 | First line. | 第一行。 |
| 00:03 --> 00:05 | Second line. | 第二行。 |`)

    expect(result.format).toBe("tabular")
    expect(result.cues).toHaveLength(2)
    expect(result.cues[0]).toMatchObject({
      startSeconds: 1,
      endSeconds: 3,
      text: "First line.",
      translation: "第一行。",
    })
  })

  it("parses quoted CSV without splitting punctuation inside subtitles", () => {
    const result = parseSubtitleDocument(`time,subtitle,machine translation
5s,"Not many, probably 3, 4.","不多，大概三四个吧。"
9s,"Continue, please.","请继续。"`)

    expect(result.format).toBe("tabular")
    expect(result.cues.map((cue) => cue.text)).toEqual([
      "Not many, probably 3, 4.",
      "Continue, please.",
    ])
  })

  it("parses generic JSON subtitle arrays", () => {
    const result = parseSubtitleDocument(
      JSON.stringify([
        {
          start: "5s",
          end: "9s",
          subtitle: "A JSON subtitle.",
          machineTranslation: "一条 JSON 字幕。",
        },
      ]),
    )

    expect(result).toEqual({
      format: "json",
      cues: [
        {
          startSeconds: 5,
          endSeconds: 9,
          text: "A JSON subtitle.",
          translation: "一条 JSON 字幕。",
        },
      ],
    })
  })

  it("parses YouTube json3 events", () => {
    const cues = parseYouTubeTranscript({
      events: [
        {
          tStartMs: 1200,
          dDurationMs: 2300,
          segs: [{ utf8: ">> Public " }, { utf8: "captions &amp; timing" }],
        },
        { tStartMs: 4000, segs: [{ utf8: "\n" }] },
      ],
    })

    expect(cues).toEqual([
      {
        startSeconds: 1.2,
        endSeconds: 3.5,
        text: "Public captions & timing",
        translation: "",
      },
    ])
  })

  it("parses Bilibili subtitle bodies", () => {
    const cues = parseBilibiliTranscript({
      body: [
        { from: 4.5, to: 7.25, content: ">> 字幕  内容" },
        { from: 8, to: 7, content: "invalid" },
      ],
    })

    expect(cues).toEqual([
      {
        startSeconds: 4.5,
        endSeconds: 7.25,
        text: "字幕 内容",
        translation: "",
      },
    ])
  })

  it("serializes platform cues as parseable WebVTT", () => {
    const content = subtitleCuesToVtt([
      {
        startSeconds: 65.125,
        endSeconds: 67.5,
        text: "Automatic caption",
        translation: "",
      },
    ])

    expect(parseSubtitleFile(content)).toEqual([
      {
        startSeconds: 65.125,
        endSeconds: 67.5,
        text: "Automatic caption",
        translation: "",
      },
    ])
  })

  it("compares subtitle rows by their start timestamp", () => {
    const original = [
      {
        startSeconds: 1,
        endSeconds: 2,
        text: "Keep this line.",
        translation: "保留这一行。",
      },
      {
        startSeconds: 3,
        endSeconds: 4,
        text: "Old text.",
        translation: "",
      },
      {
        startSeconds: 5,
        endSeconds: 6,
        text: "Remove this line.",
        translation: "",
      },
    ]
    const incoming = [
      original[0],
      {
        startSeconds: 3,
        endSeconds: 4.5,
        text: "Updated text.",
        translation: "",
      },
      {
        startSeconds: 7,
        endSeconds: 8,
        text: "Add this line.",
        translation: "",
      },
    ]

    expect(compareSubtitleCues(original, incoming).map((item) => item.status)).toEqual([
      "unchanged",
      "changed",
      "removed",
      "added",
    ])
  })

  it("formats subtitle timestamps with millisecond precision", () => {
    expect(formatSubtitleTimestamp(65.125)).toBe("00:01:05.125")
  })

  it("groups adjacent subtitle rows into complete sentences", () => {
    const cues = [
      { id: "one", startSeconds: 0, endSeconds: 1, text: "This is" },
      { id: "two", startSeconds: 1, endSeconds: 2, text: "one sentence." },
      { id: "three", startSeconds: 2.2, endSeconds: 3, text: "Another one!" },
    ]

    expect(groupSubtitleCuesBySentence(cues)).toEqual([
      {
        cues: cues.slice(0, 2),
        text: "This is one sentence.",
      },
      {
        cues: cues.slice(2),
        text: "Another one!",
      },
    ])
    expect(selectSubtitleSentenceCueIds(cues, ["one"], 24)).toEqual(["one", "two"])
  })

  it("uses timing gaps as content boundaries", () => {
    const cues = [
      { id: "one", startSeconds: 0, endSeconds: 1, text: "A short thought" },
      { id: "two", startSeconds: 5, endSeconds: 6, text: "A new scene" },
    ]

    expect(groupSubtitleCuesBySentence(cues).map((group) => group.text)).toEqual([
      "A short thought",
      "A new scene",
    ])
  })

  it("returns the complete bilingual sentence around a selected cue", () => {
    const cues = [
      {
        id: "one",
        startSeconds: 2,
        endSeconds: 3,
        text: "The model",
        translation: "",
      },
      {
        id: "two",
        startSeconds: 3,
        endSeconds: 4,
        text: "converges quickly.",
        translation: "模型快速收敛。",
      },
    ]

    expect(getSubtitleSentenceContext(cues, "one")).toEqual({
      startSeconds: 2,
      text: "The model converges quickly.",
      translation: "模型快速收敛。",
    })
    expect(getSubtitleSentenceContext(cues, "missing")).toBeNull()
  })

  it("places a complete sentence translation on its first cue", () => {
    const cues = [
      {
        id: "one",
        startSeconds: 2,
        endSeconds: 3,
        text: "The model",
        translation: "",
      },
      {
        id: "two",
        startSeconds: 3,
        endSeconds: 4,
        text: "converges quickly.",
        translation: "模型快速收敛。",
      },
    ]

    expect(placeSubtitleTranslationsAtSentenceStart(cues)).toEqual([
      { ...cues[0], translation: "模型快速收敛。" },
      { ...cues[1], translation: "" },
    ])
    expect(cues[1]?.translation).toBe("模型快速收敛。")
  })
})
