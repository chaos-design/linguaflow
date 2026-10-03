import { authFormConfig } from "./auth-form-config"

export type PasswordStrengthLevel = "empty" | "weak" | "medium" | "strong"

export interface PasswordStrength {
  hint: string
  label: "待输入" | "弱" | "中" | "强"
  level: PasswordStrengthLevel
  value: 0 | 1 | 2 | 3
}

export function getPasswordStrength(value: string): PasswordStrength {
  if (!value) {
    return {
      hint: `至少 ${authFormConfig.password.minimumLength} 位，建议组合大小写字母、数字与符号`,
      label: "待输入",
      level: "empty",
      value: 0,
    }
  }

  if (value.length < authFormConfig.password.minimumLength) {
    return {
      hint: `至少 ${authFormConfig.password.minimumLength} 位，还需 ${
        authFormConfig.password.minimumLength - value.length
      } 位`,
      label: "弱",
      level: "weak",
      value: 1,
    }
  }

  const categoryCount = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^a-zA-Z\d]/.test(value),
  ].filter(Boolean).length

  if (
    (categoryCount >= 4 && value.length >= 8) ||
    (categoryCount >= 3 && value.length >= 12)
  ) {
    return {
      hint: `至少 ${authFormConfig.password.minimumLength} 位；长度与字符组合良好`,
      label: "强",
      level: "strong",
      value: 3,
    }
  }

  if (categoryCount >= 3 || (categoryCount >= 2 && value.length >= 10)) {
    return {
      hint: `至少 ${authFormConfig.password.minimumLength} 位；再增加长度或补充一种字符类型`,
      label: "中",
      level: "medium",
      value: 2,
    }
  }

  return {
    hint: `至少 ${authFormConfig.password.minimumLength} 位；建议加入大写字母、数字或符号`,
    label: "弱",
    level: "weak",
    value: 1,
  }
}
