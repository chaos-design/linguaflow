import { describe, expect, it } from "vitest"
import {
  classifyEmailConfirmationError,
  getEmailConfirmationFeedback,
} from "@/server/auth/email-confirmation"

describe("email confirmation", () => {
  it.each([
    ["email_already_confirmed", "Email is already verified", "already-verified"],
    ["otp_expired", "Email link is invalid or has expired", "expired"],
    ["bad_code_verifier", "Code verifier mismatch", "invalid"],
  ] as const)("classifies %s (%s) as %s", (errorCode, errorMessage, expectedStatus) => {
    expect(classifyEmailConfirmationError(errorCode, errorMessage)).toBe(expectedStatus)
  })

  it("returns only allow-listed user feedback", () => {
    expect(getEmailConfirmationFeedback("verified")).toEqual({
      error: "",
      message: "邮箱验证成功，请登录后继续。",
    })
    expect(getEmailConfirmationFeedback("provider-internal-error")).toBeNull()
    expect(getEmailConfirmationFeedback(undefined)).toBeNull()
  })
})
