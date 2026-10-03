const defaultRedirectPath = "/workspace"

export function sanitizeRedirectPath(
  value: string | null | undefined,
  fallback = defaultRedirectPath,
): string {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /^[a-z][a-z\d+.-]*:/i.test(value)
  ) {
    return fallback
  }

  try {
    const url = new URL(value, "https://app.local")
    return url.origin === "https://app.local"
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback
  } catch {
    return fallback
  }
}
