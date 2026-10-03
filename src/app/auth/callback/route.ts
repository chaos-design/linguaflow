import { NextResponse } from "next/server"
import { createClient } from "../../../lib/supabase/server"
import {
  classifyEmailConfirmationError,
  type EmailConfirmationStatus,
} from "../../../server/auth/email-confirmation"
import { sanitizeRedirectPath } from "../../../server/auth/redirect-path"

function createLoginRedirect(
  requestUrl: URL,
  nextPath: string,
  options: { confirmation: EmailConfirmationStatus } | { error: "recovery-link" },
) {
  const loginUrl = new URL("/login", requestUrl.origin)
  loginUrl.searchParams.set("next", nextPath)

  if ("confirmation" in options) {
    loginUrl.searchParams.set("confirmation", options.confirmation)
  } else {
    loginUrl.searchParams.set("error", options.error)
  }

  return NextResponse.redirect(loginUrl)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const nextPath = sanitizeRedirectPath(requestUrl.searchParams.get("next"))
  const isPasswordRecovery =
    new URL(nextPath, requestUrl.origin).pathname === "/reset-password"
  const code = requestUrl.searchParams.get("code")

  if (!code) {
    if (isPasswordRecovery) {
      return createLoginRedirect(requestUrl, nextPath, { error: "recovery-link" })
    }

    return createLoginRedirect(requestUrl, nextPath, {
      confirmation: classifyEmailConfirmationError(
        requestUrl.searchParams.get("error_code") ??
          requestUrl.searchParams.get("error"),
        requestUrl.searchParams.get("error_description"),
      ),
    })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    if (isPasswordRecovery) {
      return createLoginRedirect(requestUrl, nextPath, { error: "recovery-link" })
    }

    return createLoginRedirect(requestUrl, nextPath, {
      confirmation: classifyEmailConfirmationError(error.code, error.message),
    })
  }

  if (isPasswordRecovery) {
    return NextResponse.redirect(new URL(nextPath, requestUrl.origin))
  }

  await supabase.auth.signOut({ scope: "local" })
  return createLoginRedirect(requestUrl, nextPath, {
    confirmation: "verified",
  })
}
