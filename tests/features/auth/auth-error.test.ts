import { describe, expect, it } from "vitest"
import { getAuthErrorMessage } from "@/features/auth/auth-error"

describe("auth error", () => {
  it.each([
    ["Invalid login credentials", "邮箱或密码不正确"],
    ["Email not confirmed", "请先完成邮箱验证"],
    ["Signups not allowed for otp", "该邮箱尚未注册，请先创建账户"],
    ["Email is already verified", "该邮箱已完成验证，请直接登录"],
    ["User already registered", "该邮箱已有账户，请直接登录"],
    [
      "Registration email domain is not supported.",
      "仅支持 QQ、网易、Gmail、Outlook、iCloud 等常用邮箱注册",
    ],
    ["Password should be at least 6 characters", "密码长度不符合安全要求"],
    ["Email rate limit exceeded", "请求过于频繁，请稍后再试"],
    ["Token has expired or is invalid", "验证码无效或已过期，请重新获取"],
  ])("maps %s to a stable message", (message, expected) => {
    expect(getAuthErrorMessage(new Error(message))).toBe(expected)
  })

  it("does not expose unknown provider errors", () => {
    expect(getAuthErrorMessage(new Error("internal provider details"))).toBe(
      "认证服务暂时不可用，请稍后重试",
    )
    expect(getAuthErrorMessage(null)).toBe("认证服务暂时不可用，请稍后重试")
  })
})
