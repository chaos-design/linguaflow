"use client"

import { useEffect, useId, useRef } from "react"
import {
  createVimeoPostMessageUrl,
  createYouTubePostMessageUrl,
  parseVimeoPlayerMessage,
  parseYouTubePlayerMessage,
} from "./embed-player-protocol"

const youtubeOrigin = "https://www.youtube-nocookie.com"
const youtubeMessageOrigins = new Set([youtubeOrigin, "https://www.youtube.com"])
const vimeoOrigin = "https://player.vimeo.com"
const iframeAllow =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; storage-access; web-share"

export interface EmbeddedPlayerHandle {
  getCurrentTime: () => number
  isPlaying: () => boolean
  pauseVideo: () => void
  playVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
}

type PostMessageEmbedSource =
  | {
      provider: "youtube"
      videoId: string
    }
  | {
      provider: "vimeo"
      url: string
    }

export function PostMessageEmbedPlayer({
  source,
  startSeconds,
  title,
  playerRef,
  onTimeUpdate,
  onDurationChange,
  onPlaybackError,
  onPlaybackStop,
}: {
  source: PostMessageEmbedSource
  startSeconds: number
  title: string
  playerRef: { current: EmbeddedPlayerHandle | null }
  onTimeUpdate: (seconds: number) => void
  onDurationChange: (seconds: number) => void
  onPlaybackError: (errorCode: number | null) => void
  onPlaybackStop: (seconds: number) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const generatedId = useId()
  const playerId = `linguaflow-embed-${generatedId.replaceAll(":", "")}`
  const provider = source.provider
  const sourceValue = source.provider === "youtube" ? source.videoId : source.url
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
    const iframe = iframeRef.current
    if (!iframe) {
      return
    }

    const targetOrigin = provider === "youtube" ? youtubeOrigin : vimeoOrigin
    const iframeUrl =
      provider === "youtube"
        ? createYouTubePostMessageUrl(sourceValue, startSeconds, window.location.origin)
        : createVimeoPostMessageUrl(sourceValue, playerId, startSeconds)
    let currentTime = startSeconds
    let isPlaying = false
    let isReady = false
    let lastPlayerState: number | undefined
    let pendingSeek: number | null = null
    let requestedPlayback: "play" | "pause" | null = null
    let handshakeTimer: number | null = null

    function postMessage(message: Record<string, unknown>) {
      const contentWindow = iframeRef.current?.contentWindow
      if (!contentWindow) {
        return
      }
      contentWindow.postMessage(
        provider === "youtube" ? JSON.stringify(message) : message,
        targetOrigin,
      )
    }

    function sendYouTubeCommand(command: string, args: unknown[] = []) {
      postMessage({
        event: "command",
        func: command,
        args,
        id: playerId,
      })
    }

    function sendVimeoCommand(method: string, value?: unknown) {
      postMessage(value === undefined ? { method } : { method, value })
    }

    function sendSeek(seconds: number, allowSeekAhead = true) {
      if (provider === "youtube") {
        sendYouTubeCommand("seekTo", [seconds, allowSeekAhead])
      } else {
        sendVimeoCommand("setCurrentTime", seconds)
      }
    }

    function sendPlayback(command: "play" | "pause") {
      if (provider === "youtube") {
        sendYouTubeCommand(command === "play" ? "playVideo" : "pauseVideo")
      } else {
        sendVimeoCommand(command)
      }
    }

    function stopHandshake() {
      if (handshakeTimer !== null) {
        window.clearInterval(handshakeTimer)
        handshakeTimer = null
      }
    }

    function markReady() {
      if (isReady) {
        return
      }
      isReady = true
      stopHandshake()
      onPlaybackErrorRef.current(null)

      if (provider === "youtube") {
        sendYouTubeCommand("addEventListener", ["onStateChange"])
        sendYouTubeCommand("addEventListener", ["onError"])
      } else {
        for (const eventName of ["ended", "pause", "play", "playing", "timeupdate"]) {
          sendVimeoCommand("addEventListener", eventName)
        }
        sendVimeoCommand("getCurrentTime")
        sendVimeoCommand("getDuration")
      }

      if (pendingSeek !== null) {
        sendSeek(pendingSeek)
        pendingSeek = null
      }
      if (requestedPlayback) {
        sendPlayback(requestedPlayback)
      }
    }

    function startHandshake() {
      stopHandshake()
      const sendHandshake = () => {
        if (provider === "youtube") {
          postMessage({ event: "listening", id: playerId })
        } else {
          sendVimeoCommand("ping")
        }
      }
      sendHandshake()
      handshakeTimer = window.setInterval(sendHandshake, 250)
    }

    function isTrustedMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) {
        return false
      }
      return provider === "youtube"
        ? youtubeMessageOrigins.has(event.origin)
        : event.origin === vimeoOrigin
    }

    function handleMessage(event: MessageEvent) {
      if (!isTrustedMessage(event)) {
        return
      }
      const update =
        provider === "youtube"
          ? parseYouTubePlayerMessage(event.data)
          : parseVimeoPlayerMessage(event.data)
      if (!update) {
        return
      }
      if (update.ready) {
        markReady()
      }
      if (update.currentTime !== undefined && update.currentTime >= 0) {
        currentTime = update.currentTime
        onTimeUpdateRef.current(update.currentTime)
      }
      if (update.duration !== undefined && update.duration > 0) {
        onDurationChangeRef.current(Math.floor(update.duration))
      }
      if (update.errorCode !== undefined) {
        onPlaybackErrorRef.current(update.errorCode)
      }
      if (update.playerState !== undefined) {
        const wasPlaying = isPlaying
        lastPlayerState = update.playerState
        if (update.playerState === 1) {
          isPlaying = true
        } else if ([0, 2, 5].includes(update.playerState)) {
          isPlaying = false
        }
        if (wasPlaying && (update.playerState === 0 || update.playerState === 2)) {
          onPlaybackStopRef.current(currentTime)
        }
      }
    }

    const handle: EmbeddedPlayerHandle = {
      getCurrentTime: () => currentTime,
      isPlaying: () =>
        isPlaying ||
        (!isReady && requestedPlayback === "play") ||
        lastPlayerState === 1,
      pauseVideo: () => {
        requestedPlayback = "pause"
        isPlaying = false
        if (isReady) {
          sendPlayback("pause")
        }
      },
      playVideo: () => {
        requestedPlayback = "play"
        if (isReady) {
          sendPlayback("play")
        }
      },
      seekTo: (seconds, allowSeekAhead) => {
        currentTime = Math.max(0, seconds)
        if (isReady) {
          sendSeek(currentTime, allowSeekAhead)
        } else {
          pendingSeek = currentTime
        }
      },
    }

    playerRef.current = handle
    window.addEventListener("message", handleMessage)
    iframe.addEventListener("load", startHandshake)
    iframe.src = iframeUrl

    return () => {
      stopHandshake()
      window.removeEventListener("message", handleMessage)
      iframe.removeEventListener("load", startHandshake)
      if (playerRef.current === handle) {
        playerRef.current = null
      }
    }
  }, [playerId, playerRef, provider, sourceValue, startSeconds])

  return (
    <iframe
      ref={iframeRef}
      id={playerId}
      title={title}
      className="absolute inset-0 size-full border-0"
      allow={iframeAllow}
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  )
}
