const authErrorMessages: Array<[pattern: RegExp, message: string]> = [
  [/invalid login credentials/i, "邮箱或密码不正确"],
  [/email not confirmed/i, "请先完成邮箱验证"],
  [/signups not allowed for otp|user not found/i, "该邮箱尚未注册，请先创建账户"],
  [
    /already.*(?:confirm|verif)|(?:confirm|verif).*already/i,
    "该邮箱已完成验证，请直接登录",
  ],
  [/user already registered/i, "该邮箱已有账户，请直接登录"],
  [
    /registration email domain is not supported/i,
    "仅支持 QQ、网易、Gmail、Outlook、iCloud 等常用邮箱注册",
  ],
  [/password should be at least/i, "密码长度不符合安全要求"],
  [/rate limit|too many requests/i, "请求过于频繁，请稍后再试"],
  [/expired|invalid.*token|otp/i, "验证码无效或已过期，请重新获取"],
]

export function getAuthErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "")

  return (
    authErrorMessages.find(([pattern]) => pattern.test(rawMessage))?.[1] ??
    "认证服务暂时不可用，请稍后重试"
  )
}
