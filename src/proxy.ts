import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { updateSession } from "./lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  const { response, authenticated } = await updateSession(request)
  if (authenticated) {
    return response
  }

  const loginUrl = request.nextUrl.clone()
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
  loginUrl.pathname = "/login"
  loginUrl.search = ""
  loginUrl.searchParams.set("next", nextPath)

  const redirect = NextResponse.redirect(loginUrl)
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie)
  }
  return redirect
}

export const config = {
  matcher: ["/workspace/:path*"],
}
