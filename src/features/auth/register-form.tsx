"use client"

import { ArrowRightIcon, UserPlusIcon } from "lucide-react"
import { type FormEvent, useId, useMemo, useState } from "react"
import { Button } from "../../components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../components/ui/input-group"
import { Spinner } from "../../components/ui/spinner"
import { createClient } from "../../lib/supabase/client"
import { getAuthErrorMessage } from "./auth-error"
import { AuthFeedback } from "./auth-feedback"
import {
  authFormConfig,
  isAllowedRegistrationEmail,
  isValidEmail,
} from "./auth-form-config"
import { getPasswordStrength } from "./password-strength"
import { PasswordVisibilityButton } from "./password-visibility-button"
import { TermsConsent, termsConsentError } from "./terms-consent"

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [emailError, setEmailError] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [confirmationError, setConfirmationError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)
  const emailId = useId()
  const emailErrorId = useId()
  const passwordId = useId()
  const passwordErrorId = useId()
  const confirmationId = useId()
  const confirmationErrorId = useId()
  const termsConsentId = useId()
  const passwordStrength = getPasswordStrength(password)

  function getConfirmationUrl(): string {
    const confirmationUrl = new URL("/auth/confirm", window.location.origin)
    confirmationUrl.searchParams.set("next", nextPath)
    return confirmationUrl.toString()
  }

  function validatePassword(value: string): boolean {
    if (value.length < authFormConfig.password.minimumLength) {
      setPasswordError(`密码至少需要 ${authFormConfig.password.minimumLength} 位`)
      return false
    }
    setPasswordError("")
    return true
  }

  function validateConfirmation(value: string, nextPassword = password): boolean {
    if (!value) {
      setConfirmationError("请再次输入密码")
      return false
    }
    if (value !== nextPassword) {
      setConfirmationError("两次输入的密码不一致")
      return false
    }
    setConfirmationError("")
    return true
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!hasAcceptedTerms) {
      setError(termsConsentError)
      return
    }

    const formData = new FormData(event.currentTarget)
    const normalizedEmail = email.trim()
    const nextPassword = String(formData.get("password") ?? "")
    const nextConfirmation = String(formData.get("confirmation") ?? "")

    if (!isValidEmail(normalizedEmail)) {
      setEmailError(authFormConfig.email.invalidMessage)
      return
    }
    if (!isAllowedRegistrationEmail(normalizedEmail)) {
      setEmailError(authFormConfig.email.unsupportedRegistrationDomainMessage)
      return
    }
    const isPasswordValid = validatePassword(nextPassword)
    const isConfirmationValid = validateConfirmation(nextConfirmation, nextPassword)
    if (!isPasswordValid || !isConfirmationValid) {
      return
    }

    setIsSubmitting(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: nextPassword,
        options: {
          emailRedirectTo: getConfirmationUrl(),
        },
      })
      if (signUpError) {
        throw signUpError
      }

      if (data.session) {
        await supabase.auth.signOut({ scope: "local" })
        setError("认证服务未启用邮箱验证，请联系管理员完成配置。")
        return
      }

      setPassword("")
      setConfirmation("")
      setIsComplete(true)
      setMessage("确认链接已发送，请前往邮箱完成验证后返回登录。")
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={handleSubmit}>
      <FieldGroup>
        <Field
          data-disabled={isSubmitting || isComplete}
          data-invalid={Boolean(emailError)}
        >
          <FieldLabel htmlFor={emailId}>邮箱</FieldLabel>
          <Input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            disabled={isSubmitting || isComplete}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? emailErrorId : undefined}
            onChange={(event) => {
              setEmail(event.target.value)
              setEmailError("")
              setError("")
              setMessage("")
            }}
            required
          />
          <FieldError id={emailErrorId}>{emailError}</FieldError>
          <FieldDescription>
            支持 QQ、网易、Gmail、Outlook、iCloud 等常用邮箱。
          </FieldDescription>
        </Field>

        <Field
          data-disabled={isSubmitting || isComplete}
          data-invalid={Boolean(passwordError)}
        >
          <FieldLabel htmlFor={passwordId}>密码</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={passwordId}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={authFormConfig.password.minimumLength}
              value={password}
              disabled={isSubmitting || isComplete}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? passwordErrorId : undefined}
              onBlur={(event) => validatePassword(event.currentTarget.value)}
              onChange={(event) => {
                const nextValue = event.target.value
                setPassword(nextValue)
                if (passwordError) {
                  validatePassword(nextValue)
                }
                if (confirmation) {
                  validateConfirmation(confirmation, nextValue)
                }
              }}
              required
            />
            <InputGroupAddon>
              <PasswordVisibilityButton
                isVisible={showPassword}
                disabled={isSubmitting || isComplete}
                onToggle={() => setShowPassword((value) => !value)}
              />
            </InputGroupAddon>
          </InputGroup>
          <output
            className="password-strength"
            data-strength={passwordStrength.level}
            htmlFor={passwordId}
            aria-live="polite"
          >
            <span className="password-strength-heading">
              <span>密码强度</span>
              <strong>{passwordStrength.label}</strong>
            </span>
            <span className="password-strength-meter" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <small>{passwordStrength.hint}</small>
          </output>
          <FieldError id={passwordErrorId}>{passwordError}</FieldError>
        </Field>

        <Field
          data-disabled={isSubmitting || isComplete}
          data-invalid={Boolean(confirmationError)}
        >
          <FieldLabel htmlFor={confirmationId}>确认密码</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={confirmationId}
              name="confirmation"
              type={showConfirmation ? "text" : "password"}
              autoComplete="new-password"
              minLength={authFormConfig.password.minimumLength}
              value={confirmation}
              disabled={isSubmitting || isComplete}
              aria-invalid={Boolean(confirmationError)}
              aria-describedby={confirmationError ? confirmationErrorId : undefined}
              onBlur={(event) => validateConfirmation(event.currentTarget.value)}
              onChange={(event) => {
                const nextValue = event.target.value
                setConfirmation(nextValue)
                if (confirmationError) {
                  validateConfirmation(nextValue)
                }
              }}
              required
            />
            <InputGroupAddon>
              <PasswordVisibilityButton
                isVisible={showConfirmation}
                disabled={isSubmitting || isComplete}
                onToggle={() => setShowConfirmation((value) => !value)}
              />
            </InputGroupAddon>
          </InputGroup>
          <FieldError id={confirmationErrorId}>{confirmationError}</FieldError>
        </Field>

        <TermsConsent
          id={termsConsentId}
          checked={hasAcceptedTerms}
          disabled={isSubmitting || isComplete}
          invalid={error === termsConsentError}
          onCheckedChange={(checked) => {
            setHasAcceptedTerms(checked)
            if (checked && error === termsConsentError) {
              setError("")
            }
          }}
        />

        <AuthFeedback error={error} message={message} />

        <Button
          className="w-full"
          type="submit"
          disabled={
            isSubmitting ||
            isComplete ||
            !hasAcceptedTerms ||
            Boolean(passwordError) ||
            Boolean(confirmationError)
          }
        >
          {isSubmitting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <UserPlusIcon data-icon="inline-start" aria-hidden="true" />
          )}
          {isComplete ? "确认链接已发送" : "创建账户"}
          <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
        </Button>
      </FieldGroup>
    </form>
  )
}
