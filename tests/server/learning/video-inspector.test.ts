import { afterEach, describe, expect, it, vi } from "vitest"
import { parseSubtitleFile } from "@/lib/subtitles"
import {
  inspectVideoResource,
  normalizeVideoSource,
} from "@/server/learning/video-inspector"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("inspectVideoResource", () => {
  it("normalizes equivalent platform links to one stable source key", () => {
    expect(normalizeVideoSource("https://youtu.be/test?t=30")).toEqual({
      sourceKey: "youtube:test",
      sourceUrl: "https://www.youtube.com/watch?v=test",
    })
    expect(
      normalizeVideoSource("https://www.youtube.com/watch?v=test&list=demo"),
    ).toEqual({
      sourceKey: "youtube:test",
      sourceUrl: "https://www.youtube.com/watch?v=test",
    })
    expect(normalizeVideoSource("https://www.youtube-nocookie.com/embed/test")).toEqual(
      {
        sourceKey: "youtube:test",
        sourceUrl: "https://www.youtube.com/watch?v=test",
      },
    )
  })

  it("detects and normalizes public YouTube captions", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input : input.url,
      )

      if (url.pathname === "/oembed") {
        return Response.json({
          title: "Captioned lesson",
          thumbnail_url: "https://i.ytimg.com/vi/test/hqdefault.jpg",
        })
      }
      if (url.pathname === "/watch") {
        return new Response(
          '<script>ytcfg.set({"INNERTUBE_API_KEY":"test-key"});</script>',
        )
      }
      if (url.pathname === "/youtubei/v1/player") {
        return Response.json({
          captions: {
            playerCaptionsTracklistRenderer: {
              captionTracks: [
                {
                  baseUrl: "https://www.youtube.com/api/timedtext?v=test",
                  languageCode: "en",
                  kind: "asr",
                  name: { simpleText: "English (auto-generated)" },
                },
              ],
            },
          },
        })
      }
      if (url.pathname === "/api/timedtext") {
        return Response.json({
          events: [
            {
              tStartMs: 1000,
              dDurationMs: 2000,
              segs: [{ utf8: "Detected caption" }],
            },
          ],
        })
      }
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await inspectVideoResource("https://www.youtube.com/watch?v=test")

    expect(result.video).toMatchObject({
      sourceKey: "youtube:test",
      provider: "YouTube",
      title: "Captioned lesson",
      detectedCaptions: {
        cueCount: 1,
        language: "English (auto-generated)",
        generated: true,
      },
    })
    expect(parseSubtitleFile(result.transcriptContent ?? "")).toEqual([
      {
        startSeconds: 1,
        endSeconds: 3,
        text: "Detected caption",
        translation: "",
      },
    ])
  })

  it("falls back to normalized YouTube metadata when oEmbed is unauthorized", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input : input.url,
      )
      if (url.pathname === "/oembed") {
        return new Response(null, { status: 401 })
      }
      if (url.pathname === "/watch") {
        return new Response("<html><title>Public video</title></html>")
      }
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await inspectVideoResource(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    )

    expect(result).toMatchObject({
      video: {
        title: "YouTube 视频 dQw4w9WgXcQ",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        metadataLimited: true,
        detectedCaptions: null,
      },
      transcriptContent: null,
    })
  })

  it("keeps not-found platform links as errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    )

    await expect(
      inspectVideoResource("https://www.youtube.com/watch?v=missingVideo"),
    ).rejects.toThrow("视频平台返回 404")
  })

  it("falls back when Bilibili metadata is rate limited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 429 })),
    )

    const result = await inspectVideoResource(
      "https://www.bilibili.com/video/BV1UhGk6NEGs",
    )

    expect(result).toMatchObject({
      video: {
        title: "Bilibili 视频 BV1UhGk6NEGs",
        metadataLimited: true,
        detectedCaptions: null,
      },
      transcriptContent: null,
    })
  })

  it("does not request unknown direct video hosts", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await inspectVideoResource(
      "https://media.example.com/lessons/intro.mp4",
    )

    expect(result.video).toMatchObject({
      sourceKey: "url:https://media.example.com/lessons/intro.mp4",
      provider: "直链视频",
      title: "intro",
      detectedCaptions: null,
    })
    expect(result.transcriptContent).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
