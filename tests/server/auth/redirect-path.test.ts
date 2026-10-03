import { describe, expect, it } from "vitest"
import { sanitizeRedirectPath } from "@/server/auth/redirect-path"

describe("redirect path", () => {
  it("keeps valid internal paths", () => {
    expect(sanitizeRedirectPath("/workspace?tab=profile#contact")).toBe(
      "/workspace?tab=profile#contact",
    )
  })

  it.each([
    null,
    "",
    "details",
    "//example.com",
    "/\\example.com",
    "https://example.com",
    "javascript:alert(1)",
  ])("falls back for unsafe path %s", (value) => {
    expect(sanitizeRedirectPath(value)).toBe("/workspace")
  })

  it("supports an explicit safe fallback", () => {
    expect(sanitizeRedirectPath("invalid", "/")).toBe("/")
  })
})
