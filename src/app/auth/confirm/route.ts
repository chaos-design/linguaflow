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
  status: EmailConfirmationStatus,
) {
  const loginUrl = new URL("/login", requestUrl.origin)
  loginUrl.searchParams.set("next", nextPath)
  loginUrl.searchParams.set("confirmation", status)
  return NextResponse.redirect(loginUrl)
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const nextPath = sanitizeRedirectPath(requestUrl.searchParams.get("next"))
  const providerError = requestUrl.searchParams.get("error")
  const providerErrorCode = requestUrl.searchParams.get("error_code")
  const providerErrorDescription = requestUrl.searchParams.get("error_description")

  if (providerError || providerErrorCode || providerErrorDescription) {
    return createLoginRedirect(
      requestUrl,
      nextPath,
      classifyEmailConfirmationError(
        providerErrorCode ?? providerError,
        providerErrorDescription,
      ),
    )
  }

  const code = requestUrl.searchParams.get("code")
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const tokenType = requestUrl.searchParams.get("type")
  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return createLoginRedirect(
        requestUrl,
        nextPath,
        classifyEmailConfirmationError(error.code, error.message),
      )
    }
  } else if (tokenHash && (tokenType === "signup" || tokenType === "email")) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tokenType,
    })
    if (error) {
      return createLoginRedirect(
        requestUrl,
        nextPath,
        classifyEmailConfirmationError(error.code, error.message),
      )
    }
  } else {
    return createLoginRedirect(requestUrl, nextPath, "invalid")
  }

  await supabase.auth.signOut({ scope: "local" })
  return createLoginRedirect(requestUrl, nextPath, "verified")
}
