export type EmailConfirmationStatus =
  | "verified"
  | "already-verified"
  | "expired"
  | "invalid"

export interface EmailConfirmationFeedback {
  error: string
  message: string
}

const confirmationFeedback: Record<EmailConfirmationStatus, EmailConfirmationFeedback> =
  {
    verified: {
      error: "",
      message: "邮箱验证成功，请登录后继续。",
    },
    "already-verified": {
      error: "",
      message: "该邮箱已完成验证，请直接登录。",
    },
    expired: {
      error: "验证链接已过期，请返回注册页重新获取验证邮件。",
      message: "",
    },
    invalid: {
      error: "验证链接无效或已被使用。若邮箱已验证，请直接登录。",
      message: "",
    },
  }

export function classifyEmailConfirmationError(
  errorCode: string | null | undefined,
  errorMessage: string | null | undefined,
): Exclude<EmailConfirmationStatus, "verified"> {
  const details = `${errorCode ?? ""} ${errorMessage ?? ""}`

  if (/already.*(?:confirm|verif)|(?:confirm|verif).*already/i.test(details)) {
    return "already-verified"
  }
  if (/expired|otp_expired/i.test(details)) {
    return "expired"
  }
  return "invalid"
}

export function getEmailConfirmationFeedback(
  value: string | null | undefined,
): EmailConfirmationFeedback | null {
  if (
    value !== "verified" &&
    value !== "already-verified" &&
    value !== "expired" &&
    value !== "invalid"
  ) {
    return null
  }

  return confirmationFeedback[value]
}
