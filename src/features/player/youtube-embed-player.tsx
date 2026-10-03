"use client"

import { useEffect, useRef } from "react"
import type { EmbeddedPlayerHandle } from "./post-message-embed-player"

const youtubeIframeApiId = "youtube-iframe-api"
const youtubeIframeApiTimeoutMs = 8_000
const youtubeEmbedHost = "https://www.youtube.com"
const youtubeIframeAllow =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; storage-access; web-share"

interface YouTubePlayer extends EmbeddedPlayerHandle {
  destroy: () => void
  getCurrentTime: () => number
  getDuration: () => number
  getIframe: () => HTMLIFrameElement
  getPlayerState: () => number
}

interface YouTubePlayerEvent {
  target: YouTubePlayer
}

interface YouTubePlayerStateEvent extends YouTubePlayerEvent {
  data: number
}

interface YouTubePlayerErrorEvent extends YouTubePlayerEvent {
  data: number
}

interface YouTubeIframeApi {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string
      width?: string
      height?: string
      videoId?: string
      playerVars?: {
        controls: number
        fs: number
        playsinline: number
        rel: number
        start: number
        origin: string
      }
      events: {
        onError: (event: YouTubePlayerErrorEvent) => void
        onReady: (event: YouTubePlayerEvent) => void
        onStateChange: (event: YouTubePlayerStateEvent) => void
      }
    },
  ) => YouTubePlayer
}

declare global {
  interface Window {
    YT?: YouTubeIframeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let youtubeIframeApiPromise: Promise<YouTubeIframeApi> | null = null

function loadYouTubeIframeApi(): Promise<YouTubeIframeApi> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }
  if (youtubeIframeApiPromise) {
    return youtubeIframeApiPromise
  }

  youtubeIframeApiPromise = new Promise((resolve, reject) => {
    let settled = false
    const previousReadyHandler = window.onYouTubeIframeAPIReady
    const finish = (api: YouTubeIframeApi) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeout)
      resolve(api)
    }
    const fail = (error: Error) => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeout)
      youtubeIframeApiPromise = null
      reject(error)
    }
    const timeout = window.setTimeout(() => {
      fail(new Error("YouTube IFrame API timed out."))
    }, youtubeIframeApiTimeoutMs)

    window.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.()
      if (window.YT?.Player) {
        finish(window.YT)
      } else {
        fail(new Error("YouTube IFrame API did not initialize."))
      }
    }

    if (document.getElementById(youtubeIframeApiId)) {
      return
    }

    const script = document.createElement("script")
    script.id = youtubeIframeApiId
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true
    script.onerror = () => {
      script.remove()
      fail(new Error("YouTube IFrame API failed to load."))
    }
    document.head.appendChild(script)
  })

  return youtubeIframeApiPromise
}

export function YouTubeEmbedPlayer({
  videoId,
  startSeconds,
  title,
  playerRef,
  onTimeUpdate,
  onDurationChange,
  onPlaybackError,
  onPlaybackStop,
}: {
  videoId: string
  startSeconds: number
  title: string
  playerRef: { current: EmbeddedPlayerHandle | null }
  onTimeUpdate: (seconds: number) => void
  onDurationChange: (seconds: number) => void
  onPlaybackError: (errorCode: number | null) => void
  onPlaybackStop: (seconds: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onDurationChangeRef = useRef(onDurationChange)
  const onPlaybackErrorRef = useRef(onPlaybackError)
  const onPlaybackStopRef = useRef(onPlaybackStop)

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate
    onDurationChangeRef.current = onDurationChange
    onPlaybackErrorRef.current = onPlaybackError
    onPlaybackStopRef.current = onPlaybackStop
  }, [onDurationChange, onPlaybackError, onPlaybackStop, onTimeUpdate])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    // The IFrame API replaces this mount node with its own iframe. Using a
    // fresh child (instead of adopting an existing iframe) is what lets YouTube
    // render its native poster and controls.
    const mount = document.createElement("div")
    mount.className = "size-full"
    container.appendChild(mount)

    let disposed = false
    let isPlayerReady = false
    let player: YouTubePlayer | null = null
    let timeUpdateTimer: number | null = null
    let pendingSeek: { seconds: number; allowSeekAhead: boolean } | null = null
    let playRequested = false
    let iframeObserver: MutationObserver | null = null
    const configureIframe = (iframe: HTMLIFrameElement) => {
      iframe.title = title
      iframe.allow = youtubeIframeAllow
      iframe.referrerPolicy = "strict-origin-when-cross-origin"
      iframeObserver?.disconnect()
      iframeObserver = null
    }
    const handle: EmbeddedPlayerHandle = {
      getCurrentTime: () =>
        isPlayerReady ? (player?.getCurrentTime() ?? startSeconds) : startSeconds,
      isPlaying: () => (isPlayerReady ? player?.getPlayerState() === 1 : playRequested),
      pauseVideo: () => {
        playRequested = false
        if (isPlayerReady) {
          player?.pauseVideo()
        }
      },
      playVideo: () => {
        playRequested = true
        if (isPlayerReady) {
          player?.playVideo()
        }
      },
      seekTo: (seconds, allowSeekAhead) => {
        if (player && isPlayerReady) {
          player.seekTo(seconds, allowSeekAhead)
          return
        }
        pendingSeek = { seconds, allowSeekAhead }
      },
    }
    playerRef.current = handle

    void loadYouTubeIframeApi()
      .then((api) => {
        if (disposed) {
          return
        }

        iframeObserver = new MutationObserver(() => {
          const iframe = container.querySelector("iframe")
          if (iframe) {
            configureIframe(iframe)
          }
        })
        iframeObserver.observe(container, { childList: true, subtree: true })
        player = new api.Player(mount, {
          host: youtubeEmbedHost,
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            controls: 1,
            fs: 1,
            playsinline: 1,
            rel: 0,
            start: Math.floor(startSeconds),
            origin: window.location.origin,
          },
          events: {
            onError: (event) => {
              if (!disposed) {
                event.target.getIframe().hidden = true
                if (timeUpdateTimer !== null) {
                  window.clearInterval(timeUpdateTimer)
                  timeUpdateTimer = null
                }
                onPlaybackErrorRef.current(event.data)
              }
            },
            onReady: (event) => {
              if (disposed) {
                return
              }

              isPlayerReady = true
              onPlaybackErrorRef.current(null)
              const readyIframe = event.target.getIframe()
              readyIframe.hidden = false
              configureIframe(readyIframe)
              if (pendingSeek) {
                event.target.seekTo(pendingSeek.seconds, pendingSeek.allowSeekAhead)
                pendingSeek = null
              }
              if (playRequested) {
                event.target.playVideo()
              }
              const nextDuration = event.target.getDuration()
              if (Number.isFinite(nextDuration) && nextDuration > 0) {
                onDurationChangeRef.current(Math.floor(nextDuration))
              }
              onTimeUpdateRef.current(event.target.getCurrentTime())
              timeUpdateTimer = window.setInterval(() => {
                const nextTime = event.target.getCurrentTime()
                if (Number.isFinite(nextTime)) {
                  onTimeUpdateRef.current(nextTime)
                }
              }, 250)
            },
            onStateChange: (event) => {
              if (event.data === 0 || event.data === 2) {
                onPlaybackStopRef.current(event.target.getCurrentTime())
              }
            },
          },
        })
      })
      .catch(() => {
        if (playerRef.current === handle) {
          playerRef.current = null
        }
        if (!disposed) {
          onPlaybackErrorRef.current(0)
        }
      })

    return () => {
      disposed = true
      if (playerRef.current === handle) {
        playerRef.current = null
      }
      if (timeUpdateTimer !== null) {
        window.clearInterval(timeUpdateTimer)
      }
      iframeObserver?.disconnect()
      player?.destroy()
      container.replaceChildren()
    }
  }, [playerRef, startSeconds, title, videoId])

  return <div ref={containerRef} className="absolute inset-0 size-full" />
}
