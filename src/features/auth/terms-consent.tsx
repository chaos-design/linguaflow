"use client"

import Link from "next/link"
import { Checkbox } from "../../components/ui/checkbox"
import { Field, FieldLabel } from "../../components/ui/field"

export const termsConsentError = "请先阅读并同意服务条款与隐私政策"

export function TermsConsent({
  id,
  checked,
  disabled = false,
  invalid = false,
  onCheckedChange,
}: {
  id: string
  checked: boolean
  disabled?: boolean
  invalid?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field
      className="auth-consent"
      orientation="horizontal"
      data-disabled={disabled}
      data-invalid={invalid}
    >
      <Checkbox
        id={id}
        name="terms-consent"
        checked={checked}
        disabled={disabled}
        required
        aria-invalid={invalid}
        aria-required="true"
        onCheckedChange={onCheckedChange}
      />
      <span className="auth-consent-copy">
        <FieldLabel htmlFor={id}>我已阅读并同意</FieldLabel>
        <Link href="/terms" target="_blank" rel="noreferrer">
          《服务条款》
        </Link>
        <span aria-hidden="true">与</span>
        <Link href="/privacy" target="_blank" rel="noreferrer">
          《隐私政策》
        </Link>
      </span>
    </Field>
  )
}
