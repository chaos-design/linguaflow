"use client"

import { EyeIcon, EyeOffIcon } from "lucide-react"
import { InputGroupButton } from "../../components/ui/input-group"

interface PasswordVisibilityButtonProps {
  isVisible: boolean
  disabled?: boolean
  onToggle: () => void
}

export function PasswordVisibilityButton({
  isVisible,
  disabled = false,
  onToggle,
}: PasswordVisibilityButtonProps) {
  const label = isVisible ? "隐藏密码" : "显示密码"

  return (
    <InputGroupButton
      size="icon-sm"
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={isVisible}
      disabled={disabled}
      onClick={onToggle}
    >
      {isVisible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
    </InputGroupButton>
  )
}
