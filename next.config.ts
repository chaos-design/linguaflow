import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"

export default function createNextConfig(phase: string): NextConfig {
  return {
    allowedDevOrigins: ["127.0.0.1"],
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    outputFileTracingRoot: process.cwd(),
    images: {
      remotePatterns: [
        { protocol: "https", hostname: "i.ytimg.com" },
        { protocol: "https", hostname: "i.vimeocdn.com" },
        { protocol: "https", hostname: "**.hdslb.com" },
      ],
    },
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "X-Content-Type-Options",
              value: "nosniff",
            },
            {
              key: "X-Frame-Options",
              value: "DENY",
            },
            {
              key: "Referrer-Policy",
              value: "strict-origin-when-cross-origin",
            },
            {
              key: "Permissions-Policy",
              value:
                'camera=(), microphone=(), geolocation=(), storage-access=(self "https://www.youtube.com" "https://www.youtube-nocookie.com")',
            },
          ],
        },
      ]
    },
  }
}
