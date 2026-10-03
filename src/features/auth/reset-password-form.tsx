"use client"

import { ArrowRightIcon, KeyRoundIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { type FormEvent, useId, useMemo, useState } from "react"
import { Button } from "../../components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "../../components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../components/ui/input-group"
import { Spinner } from "../../components/ui/spinner"
import { createClient } from "../../lib/supabase/client"
import { getAuthErrorMessage } from "./auth-error"
import { AuthFeedback } from "./auth-feedback"
import { authFormConfig } from "./auth-form-config"
import { PasswordVisibilityButton } from "./password-visibility-button"

export function ResetPasswordForm({ nextPath }: { nextPath: string }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [confirmationError, setConfirmationError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const passwordId = useId()
  const confirmationId = useId()
  const confirmationErrorId = useId()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setConfirmationError("")

    const formData = new FormData(event.currentTarget)
    const password = String(formData.get("password") ?? "")
    const confirmation = String(formData.get("confirmation") ?? "")

    if (password !== confirmation) {
      setConfirmationError("两次输入的密码不一致")
      return
    }

    setIsSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        throw updateError
      }
      router.replace(nextPath)
      router.refresh()
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={passwordId}>新密码</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={passwordId}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={authFormConfig.password.minimumLength}
              required
            />
            <InputGroupAddon>
              <PasswordVisibilityButton
                isVisible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field data-invalid={Boolean(confirmationError)}>
          <FieldLabel htmlFor={confirmationId}>确认新密码</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={confirmationId}
              name="confirmation"
              type={showConfirmation ? "text" : "password"}
              autoComplete="new-password"
              minLength={authFormConfig.password.minimumLength}
              aria-invalid={Boolean(confirmationError)}
              aria-describedby={confirmationError ? confirmationErrorId : undefined}
              onChange={() => {
                if (confirmationError) {
                  setConfirmationError("")
                }
              }}
              required
            />
            <InputGroupAddon>
              <PasswordVisibilityButton
                isVisible={showConfirmation}
                onToggle={() => setShowConfirmation((value) => !value)}
              />
            </InputGroupAddon>
          </InputGroup>
          <FieldError id={confirmationErrorId}>{confirmationError}</FieldError>
        </Field>

        <AuthFeedback error={error} message="" />

        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
          )}
          更新密码
          <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </FieldGroup>
    </form>
  )
}
