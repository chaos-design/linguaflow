#!/usr/bin/env node

import { existsSync } from "node:fs"
import process from "node:process"

const requiredVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
]

if (!process.env.VERCEL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local")
}

const errors = []

for (const name of requiredVariables) {
  const value = process.env[name]?.trim()
  if (!value) {
    errors.push(`${name} is required.`)
  } else if (isPlaceholder(value)) {
    errors.push(`${name} still contains a placeholder value.`)
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
if (supabaseUrl) {
  validateSupabaseUrl(supabaseUrl, errors)
}

const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ""
if (publishableKey) {
  validatePublishableKey(publishableKey, errors)
}

if (errors.length > 0) {
  process.stderr.write(
    `Deployment environment validation failed:\n${errors
      .map((error) => `- ${error}`)
      .join("\n")}\n`,
  )
  process.exit(1)
}

process.stdout.write("Deployment environment validation passed.\n")

function isPlaceholder(value) {
  return /^(?:change-me|example|replace-me|todo|your[-_])/iu.test(value)
}

function validateSupabaseUrl(value, validationErrors) {
  let url
  try {
    url = new URL(value)
  } catch {
    validationErrors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.")
    return
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    validationErrors.push(
      "NEXT_PUBLIC_SUPABASE_URL must use the http or https protocol.",
    )
  }
  if (url.username || url.password || url.search || url.hash) {
    validationErrors.push(
      "NEXT_PUBLIC_SUPABASE_URL cannot contain credentials, a query, or a hash.",
    )
  }
  if (process.env.VERCEL && url.protocol !== "https:") {
    validationErrors.push(
      "NEXT_PUBLIC_SUPABASE_URL must use HTTPS for Vercel deployments.",
    )
  }
}

function validatePublishableKey(value, validationErrors) {
  if (/[\r\n\s]/u.test(value)) {
    validationErrors.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY cannot contain whitespace.",
    )
  }
  if (value.startsWith("sb_secret_")) {
    validationErrors.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY cannot contain a Supabase secret key.",
    )
    return
  }

  const jwtRole = readJwtRole(value)
  if (jwtRole === "service_role") {
    validationErrors.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY cannot contain a service role key.",
    )
  } else if (!value.startsWith("sb_publishable_") && jwtRole !== "anon") {
    validationErrors.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key or legacy anon key.",
    )
  }
}

function readJwtRole(value) {
  const parts = value.split(".")
  if (parts.length !== 3) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"))
    return typeof payload.role === "string" ? payload.role : null
  } catch {
    return null
  }
}
