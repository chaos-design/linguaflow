"use client"

import { ArrowRightIcon, KeyRoundIcon } from "lucide-react"
import Link from "next/link"
import { type FormEvent, useEffect, useId, useMemo, useState } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { createClient } from "../../lib/supabase/client"
import { getAuthErrorMessage } from "./auth-error"
import { AuthFeedback } from "./auth-feedback"
import { authFormConfig, isValidEmail, isValidEmailCode } from "./auth-form-config"
import { PasswordVisibilityButton } from "./password-visibility-button"
import { RegisterForm } from "./register-form"
import { TermsConsent, termsConsentError } from "./terms-consent"

type AuthMode = "password" | "email-code" | "register"
type PendingAction = "password" | "email-code-request" | "email-code-verify" | null

interface AuthPanelCopy {
  cardIndex: string
  heading: string
  description: string
}

const passwordLoginConfig: AuthPanelCopy = {
  cardIndex: "LINGUAFLOW / ACCOUNT",
  heading: "登录账户",
  description: "使用密码或邮箱验证码进入个人学习空间。",
}

const emailCodeConfig: AuthPanelCopy = {
  cardIndex: "LINGUAFLOW / EMAIL CODE",
  heading: "邮箱验证码登录",
  description: `获取 ${authFormConfig.emailCode.length} 位验证码并进入学习空间。`,
}

const registerConfig: AuthPanelCopy = {
  cardIndex: "LINGUAFLOW / CREATE ACCOUNT",
  heading: "创建账户",
  description: "验证邮箱后，即可建立你的个人视频学习空间。",
}

export function LoginForm({
  nextPath,
  initialError = "",
  initialMessage = "",
  initialMode = "password",
}: {
  nextPath: string
  initialError?: string
  initialMessage?: string
  initialMode?: "password" | "register"
}) {
  const supabase = useMemo(() => createClient(), [])
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(initialError)
  const [message, setMessage] = useState(initialMessage)
  const [emailError, setEmailError] = useState("")
  const [passwordValue, setPasswordValue] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [emailCodeEmail, setEmailCodeEmail] = useState("")
  const [emailCodeValue, setEmailCodeValue] = useState("")
  const [emailCodeError, setEmailCodeError] = useState("")
  const [hasSentEmailCode, setHasSentEmailCode] = useState(false)
  const [emailCodeCooldown, setEmailCodeCooldown] = useState(0)
  const [emailCodeCooldownEndsAt, setEmailCodeCooldownEndsAt] = useState<number | null>(
    null,
  )
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false)
  const passwordEmailId = useId()
  const passwordEmailErrorId = useId()
  const passwordId = useId()
  const passwordErrorId = useId()
  const emailCodeEmailId = useId()
  const emailCodeEmailErrorId = useId()
  const emailCodeId = useId()
  const emailCodeErrorId = useId()
  const termsConsentId = useId()
  const isSubmitting = pendingAction !== null
  const isRegistering = authMode === "register"
  const isEmailCodeCoolingDown = emailCodeCooldown > 0
  const headerCopy =
    authMode === "password"
      ? passwordLoginConfig
      : authMode === "email-code"
        ? emailCodeConfig
        : registerConfig

  useEffect(() => {
    if (emailCodeCooldownEndsAt === null) {
      return
    }
    const cooldownEndsAt = emailCodeCooldownEndsAt

    function updateCooldown() {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((cooldownEndsAt - Date.now()) / 1000),
      )
      setEmailCodeCooldown(remainingSeconds)
      if (remainingSeconds === 0) {
        setEmailCodeCooldownEndsAt(null)
      }
    }

    updateCooldown()
    const intervalId = window.setInterval(updateCooldown, 1000)
    return () => window.clearInterval(intervalId)
  }, [emailCodeCooldownEndsAt])

  function clearFeedback() {
    setError("")
    setMessage("")
    setEmailError("")
    setPasswordError("")
    setEmailCodeError("")
  }

  function switchLoginMode(nextMode: "password" | "email-code") {
    setAuthMode(nextMode)
    clearFeedback()
  }

  function validatePassword(value: string): boolean {
    if (!value) {
      setPasswordError(authFormConfig.password.requiredMessage)
      return false
    }
    setPasswordError("")
    return true
  }

  function validateTermsConsent(): boolean {
    if (!hasAcceptedTerms) {
      setError(termsConsentError)
      return false
    }
    return true
  }

  function handleTermsCheckedChange(checked: boolean) {
    setHasAcceptedTerms(checked)
    if (checked && error === termsConsentError) {
      setError("")
    }
  }

  function startEmailCodeCooldown() {
    const cooldownSeconds = authFormConfig.emailCode.resendCooldownSeconds
    setEmailCodeCooldown(cooldownSeconds)
    setEmailCodeCooldownEndsAt(Date.now() + cooldownSeconds * 1000)
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()

    if (!validateTermsConsent()) {
      return
    }

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "").trim()
    const password = String(formData.get("password") ?? "")
    if (!isValidEmail(email)) {
      setEmailError(authFormConfig.email.invalidMessage)
      return
    }
    if (!validatePassword(password)) {
      return
    }

    setPendingAction("password")
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        throw signInError
      }

      window.location.assign(nextPath)
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError))
    } finally {
      setPendingAction(null)
    }
  }

  async function sendEmailCode(email: string) {
    const { error: emailCodeError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    })
    if (emailCodeError) {
      throw emailCodeError
    }
  }

  async function handleEmailCodeRequest() {
    clearFeedback()

    const email = emailCodeEmail.trim()
    if (!isValidEmail(email)) {
      setEmailError(authFormConfig.email.invalidMessage)
      return
    }

    setPendingAction("email-code-request")
    try {
      await sendEmailCode(email)
      setEmailCodeEmail(email)
      setEmailCodeValue("")
      setHasSentEmailCode(true)
      startEmailCodeCooldown()
      setMessage(`验证码已发送至 ${email}`)
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError))
    } finally {
      setPendingAction(null)
    }
  }

  async function handleEmailCodeVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()

    if (!validateTermsConsent()) {
      return
    }

    const email = emailCodeEmail.trim()
    if (!isValidEmail(email)) {
      setEmailError(authFormConfig.email.invalidMessage)
      return
    }

    const token = emailCodeValue.trim()
    if (!isValidEmailCode(token)) {
      setEmailCodeError(authFormConfig.emailCode.invalidMessage)
      return
    }

    setPendingAction("email-code-verify")
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "email",
      })
      if (verifyError) {
        throw verifyError
      }
      window.location.assign(nextPath)
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError))
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <>
      <header className="login-card-header">
        <span className="auth-entry-index">{headerCopy.cardIndex}</span>
        <h2>{headerCopy.heading}</h2>
        <p>{headerCopy.description}</p>
      </header>

      <div className="auth-panel">
        {!isRegistering ? (
          <Tabs
            className="auth-mode-tabs"
            value={authMode}
            onValueChange={(nextMode) => {
              if (nextMode === "password" || nextMode === "email-code") {
                switchLoginMode(nextMode)
              }
            }}
          >
            <TabsList
              className="auth-mode-tabs-list hidden"
              variant="line"
              aria-label="选择登录方式"
              activateOnFocus
            >
              <TabsTrigger value="password" disabled={isSubmitting}>
                密码登录
              </TabsTrigger>
              <TabsTrigger value="email-code" disabled={isSubmitting}>
                邮箱验证码
              </TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <form className="auth-form" noValidate onSubmit={handlePasswordSubmit}>
                <FieldGroup>
                  <Field data-invalid={Boolean(emailError)}>
                    <FieldLabel htmlFor={passwordEmailId}>邮箱</FieldLabel>
                    <Input
                      id={passwordEmailId}
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      aria-invalid={Boolean(emailError)}
                      aria-describedby={emailError ? passwordEmailErrorId : undefined}
                      onChange={() => {
                        if (emailError) {
                          setEmailError("")
                        }
                      }}
                      required
                    />
                    <FieldError id={passwordEmailErrorId}>{emailError}</FieldError>
                    <FieldDescription>使用已验证邮箱登录。</FieldDescription>
                  </Field>

                  <Field data-invalid={Boolean(passwordError)}>
                    <div className="field-label-row">
                      <FieldLabel htmlFor={passwordId}>密码</FieldLabel>
                      <Link
                        href={`/forgot-password?next=${encodeURIComponent(nextPath)}`}
                      >
                        忘记密码？
                      </Link>
                    </div>
                    <InputGroup>
                      <InputGroupInput
                        id={passwordId}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        minLength={authFormConfig.password.minimumLength}
                        value={passwordValue}
                        aria-invalid={Boolean(passwordError)}
                        aria-describedby={passwordError ? passwordErrorId : undefined}
                        onBlur={(event) => {
                          if (!event.currentTarget.value) {
                            setPasswordError(authFormConfig.password.requiredMessage)
                          }
                        }}
                        onChange={(event) => {
                          const nextValue = event.target.value
                          setPasswordValue(nextValue)
                          if (passwordError) {
                            validatePassword(nextValue)
                          }
                        }}
                        required
                      />
                      <InputGroupAddon>
                        <PasswordVisibilityButton
                          isVisible={showPassword}
                          onToggle={() => setShowPassword((value) => !value)}
                        />
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldError id={passwordErrorId}>{passwordError}</FieldError>
                  </Field>

                  <TermsConsent
                    id={termsConsentId}
                    checked={hasAcceptedTerms}
                    invalid={error === termsConsentError}
                    onCheckedChange={handleTermsCheckedChange}
                  />

                  <AuthFeedback error={error} message={message} />

                  <Button
                    className="w-full"
                    type="submit"
                    disabled={
                      isSubmitting || Boolean(passwordError) || !hasAcceptedTerms
                    }
                  >
                    {pendingAction === "password" ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
                    )}
                    登录并继续
                    <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
                  </Button>
                </FieldGroup>
              </form>
            </TabsContent>

            <TabsContent value="email-code">
              <form className="auth-form" noValidate onSubmit={handleEmailCodeVerify}>
                <FieldGroup>
                  <Field data-invalid={Boolean(emailError)}>
                    <div className="field-label-row">
                      <FieldLabel htmlFor={emailCodeEmailId}>邮箱</FieldLabel>
                      <a
                        className="auth-code-request-link"
                        href={`#${emailCodeEmailId}`}
                        aria-busy={pendingAction === "email-code-request"}
                        aria-disabled={isSubmitting || isEmailCodeCoolingDown}
                        onClick={(event) => {
                          event.preventDefault()
                          if (isSubmitting || isEmailCodeCoolingDown) {
                            return
                          }
                          void handleEmailCodeRequest()
                        }}
                      >
                        {pendingAction === "email-code-request"
                          ? "发送中..."
                          : isEmailCodeCoolingDown
                            ? `${emailCodeCooldown}s 后重发`
                            : hasSentEmailCode
                              ? "重新发送"
                              : "获取验证码"}
                      </a>
                    </div>
                    <Input
                      id={emailCodeEmailId}
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={emailCodeEmail}
                      aria-invalid={Boolean(emailError)}
                      aria-describedby={emailError ? emailCodeEmailErrorId : undefined}
                      onChange={(event) => {
                        setEmailCodeEmail(event.target.value)
                        setHasSentEmailCode(false)
                        setEmailCodeValue("")
                        clearFeedback()
                      }}
                      required
                    />
                    <FieldError id={emailCodeEmailErrorId}>{emailError}</FieldError>
                    <FieldDescription>
                      仅已注册账户可获取验证码；未注册用户请先创建账户。
                    </FieldDescription>
                  </Field>

                  <Field data-invalid={Boolean(emailCodeError)}>
                    <FieldLabel htmlFor={emailCodeId}>邮箱验证码</FieldLabel>
                    <Input
                      id={emailCodeId}
                      name="token"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern={authFormConfig.emailCode.inputPattern}
                      maxLength={authFormConfig.emailCode.length}
                      value={emailCodeValue}
                      aria-invalid={Boolean(emailCodeError)}
                      aria-describedby={emailCodeError ? emailCodeErrorId : undefined}
                      onChange={(event) => {
                        setEmailCodeValue(
                          event.target.value
                            .replace(/\D/g, "")
                            .slice(0, authFormConfig.emailCode.length),
                        )
                        if (emailCodeError) {
                          setEmailCodeError("")
                        }
                        if (error) {
                          setError("")
                        }
                      }}
                      required
                    />
                    <FieldError id={emailCodeErrorId}>{emailCodeError}</FieldError>
                  </Field>

                  <TermsConsent
                    id={termsConsentId}
                    checked={hasAcceptedTerms}
                    invalid={error === termsConsentError}
                    onCheckedChange={handleTermsCheckedChange}
                  />

                  <AuthFeedback error={error} message={message} />

                  <Button
                    className="w-full"
                    type="submit"
                    disabled={isSubmitting || !hasAcceptedTerms}
                  >
                    {pendingAction === "email-code-verify" ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
                    )}
                    验证并登录
                    <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
                  </Button>
                </FieldGroup>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          <RegisterForm nextPath={nextPath} />
        )}

        <p
          className="auth-account-switch"
          data-mode={isRegistering ? "register" : "login"}
        >
          <span>{isRegistering ? "已有账户？" : "第一次使用？"}</span>
          <Link
            className="auth-account-link"
            href={
              isRegistering
                ? `/login?next=${encodeURIComponent(nextPath)}`
                : `/login?mode=register&next=${encodeURIComponent(nextPath)}`
            }
          >
            {isRegistering ? "去登录" : "去注册"}
          </Link>
        </p>
      </div>
    </>
  )
}
