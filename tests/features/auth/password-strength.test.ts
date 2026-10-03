import { describe, expect, it } from "vitest"
import { getPasswordStrength } from "@/features/auth/password-strength"

describe("password strength", () => {
  it.each([
    ["", "empty", "待输入", 0, "至少 6 位，建议组合大小写字母、数字与符号"],
    ["abc", "weak", "弱", 1, "至少 6 位，还需 3 位"],
    ["abc123", "weak", "弱", 1, "至少 6 位；建议加入大写字母、数字或符号"],
    ["Abc123", "medium", "中", 2, "至少 6 位；再增加长度或补充一种字符类型"],
    ["abcdefghij1", "medium", "中", 2, "至少 6 位；再增加长度或补充一种字符类型"],
    ["Abc123!@", "strong", "强", 3, "至少 6 位；长度与字符组合良好"],
  ] as const)(
    "classifies %s as %s",
    (password, expectedLevel, expectedLabel, expectedValue, expectedHint) => {
      expect(getPasswordStrength(password)).toEqual({
        hint: expectedHint,
        label: expectedLabel,
        level: expectedLevel,
        value: expectedValue,
      })
    },
  )
})
