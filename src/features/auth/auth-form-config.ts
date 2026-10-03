const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const emailCodeLength = 6
const emailCodePattern = new RegExp(`^\\d{${emailCodeLength}}$`)
const commonRegistrationEmailDomains = new Set([
  "126.com",
  "139.com",
  "163.com",
  "189.cn",
  "aliyun.com",
  "foxmail.com",
  "gmail.com",
  "hotmail.com",
  "icloud.com",
  "live.cn",
  "live.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "qq.com",
  "sina.cn",
  "sina.com",
  "sohu.com",
  "wo.cn",
  "yahoo.com",
  "yahoo.com.cn",
  "yeah.net",
])

export const authFormConfig = {
  email: {
    invalidMessage: "请输入有效邮箱",
    unsupportedRegistrationDomainMessage:
      "仅支持 QQ、网易、Gmail、Outlook、iCloud 等常用邮箱注册",
  },
  password: {
    minimumLength: 6,
    requiredMessage: "请输入密码",
  },
  emailCode: {
    inputPattern: `[0-9]{${emailCodeLength}}`,
    invalidMessage: `请输入 ${emailCodeLength} 位邮箱验证码`,
    length: emailCodeLength,
    resendCooldownSeconds: 60,
  },
} as const

export function isValidEmail(value: string): boolean {
  return emailPattern.test(value)
}

export function isAllowedRegistrationEmail(value: string): boolean {
  if (!isValidEmail(value)) {
    return false
  }
  const domain = value.slice(value.lastIndexOf("@") + 1).toLocaleLowerCase("en")
  return commonRegistrationEmailDomains.has(domain)
}

export function isValidEmailCode(value: string): boolean {
  return emailCodePattern.test(value)
}
