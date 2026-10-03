import { describe, expect, it } from "vitest"
import {
  authFormConfig,
  isAllowedRegistrationEmail,
  isValidEmail,
  isValidEmailCode,
} from "@/features/auth/auth-form-config"

describe("auth form config", () => {
  it.each([
    ["user@example.com", true],
    [" user@example.com ", false],
    ["user@example", false],
    ["user@", false],
  ])("validates email %s", (value, expected) => {
    expect(isValidEmail(value)).toBe(expected)
  })

  it.each([
    ["user@qq.com", true],
    ["user@163.com", true],
    ["user@GMAIL.COM", true],
    ["user@outlook.com", true],
    ["user@icloud.com", true],
    ["user@example.com", false],
    ["user@temporary-mail.test", false],
    ["invalid-email", false],
  ])("checks whether %s can be used to register", (value, expected) => {
    expect(isAllowedRegistrationEmail(value)).toBe(expected)
  })

  it("keeps the email code input and validation length aligned", () => {
    expect(authFormConfig.emailCode.inputPattern).toBe("[0-9]{6}")
    expect(authFormConfig.emailCode.resendCooldownSeconds).toBe(60)
    expect(isValidEmailCode("123456")).toBe(true)
    expect(isValidEmailCode("12345")).toBe(false)
    expect(isValidEmailCode("12345a")).toBe(false)
  })
})
