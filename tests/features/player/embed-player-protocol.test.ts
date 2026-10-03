import { describe, expect, it } from "vitest"
import {
  createVimeoPostMessageUrl,
  createYouTubePostMessageUrl,
  parseVimeoPlayerMessage,
  parseYouTubePlayerMessage,
} from "@/features/player/embed-player-protocol"

describe("embed player protocol", () => {
  it("creates a controllable YouTube privacy embed URL", () => {
    const result = new URL(
      createYouTubePostMessageUrl("video/id", 12.9, "https://app.example.com"),
    )

    expect(result.origin).toBe("https://www.youtube-nocookie.com")
    expect(result.pathname).toBe("/embed/video%2Fid")
    expect(result.searchParams.get("enablejsapi")).toBe("1")
    expect(result.searchParams.get("origin")).toBe("https://app.example.com")
    expect(result.searchParams.get("start")).toBe("12")
  })

  it("preserves Vimeo privacy parameters while enabling postMessage", () => {
    const result = new URL(
      createVimeoPostMessageUrl(
        "https://player.vimeo.com/video/123?h=private",
        "player-1",
        24.8,
      ),
    )

    expect(result.searchParams.get("h")).toBe("private")
    expect(result.searchParams.get("api")).toBe("1")
    expect(result.searchParams.get("player_id")).toBe("player-1")
    expect(result.hash).toBe("#t=24s")
  })

  it("parses YouTube state and timing deliveries", () => {
    expect(
      parseYouTubePlayerMessage(
        JSON.stringify({
          event: "initialDelivery",
          info: {
            currentTime: 8.25,
            duration: 120,
            playerState: 1,
          },
        }),
      ),
    ).toEqual({
      currentTime: 8.25,
      duration: 120,
      playerState: 1,
    })
    expect(parseYouTubePlayerMessage({ event: "onReady" })).toEqual({
      ready: true,
    })
    expect(parseYouTubePlayerMessage({ event: "onError", info: 150 })).toEqual({
      errorCode: 150,
    })
  })

  it("parses Vimeo readiness, timing, and playback state", () => {
    expect(parseVimeoPlayerMessage({ method: "ping", value: true })).toEqual({
      ready: true,
    })
    expect(
      parseVimeoPlayerMessage({
        event: "timeupdate",
        data: { seconds: 31.5, duration: 180 },
      }),
    ).toEqual({
      currentTime: 31.5,
      duration: 180,
    })
    expect(parseVimeoPlayerMessage({ event: "pause" })).toEqual({
      playerState: 2,
    })
  })

  it("ignores malformed or unrelated messages", () => {
    expect(parseYouTubePlayerMessage("not-json")).toBeNull()
    expect(parseYouTubePlayerMessage({ event: "unknown" })).toBeNull()
    expect(parseVimeoPlayerMessage({ event: "unknown" })).toBeNull()
  })
})
