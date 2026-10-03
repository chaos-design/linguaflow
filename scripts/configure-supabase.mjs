#!/usr/bin/env node

import { chmod, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const projectRoot = path.resolve(import.meta.dirname, "..")

function printUsage() {
  process.stdout.write(`Configure Supabase for this project.

Usage:
  node scripts/configure-supabase.mjs [options]

Connection:
  --project-ref <ref>          Hosted Supabase project ref
  --url <url>                  Supabase URL; derived from project ref when omitted
  --publishable-key <key>      Public key; fetched with SUPABASE_ACCESS_TOKEN when omitted
  --output-env-file <path>     Environment file (default: .env.local)

Auth configuration:
  --site-url <url>             Primary hosted Auth site URL
  --dev-port <port>            Local callback port (default: 3000)
  --configure-remote           Push Auth settings and email templates
  --no-configure-remote        Only create the local environment file

Authentication:
  SUPABASE_ACCESS_TOKEN        Required for key discovery and remote configuration

The access token is read only from the environment and is never written to disk.
`)
}

function fail(message) {
  throw new Error(message)
}

function requireValue(args, index, option) {
  const value = args[index + 1]
  if (!value || value.startsWith("--")) {
    fail(`${option} requires a value.`)
  }
  return value
}

function parseArguments(args) {
  const options = {
    projectRef: "",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "",
    envFile: ".env.local",
    siteUrl: "",
    devPort: 3000,
    configureRemote: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    switch (argument) {
      case "--project-ref":
        options.projectRef = requireValue(args, index, argument)
        index += 1
        break
      case "--url":
        options.supabaseUrl = requireValue(args, index, argument)
        index += 1
        break
      case "--publishable-key":
        options.publishableKey = requireValue(args, index, argument)
        index += 1
        break
      case "--output-env-file":
        options.envFile = requireValue(args, index, argument)
        index += 1
        break
      case "--site-url":
        options.siteUrl = requireValue(args, index, argument)
        index += 1
        break
      case "--dev-port":
        options.devPort = Number(requireValue(args, index, argument))
        index += 1
        break
      case "--configure-remote":
        options.configureRemote = true
        break
      case "--no-configure-remote":
        options.configureRemote = false
        break
      case "--help":
      case "-h":
        printUsage()
        process.exit(0)
        break
      case "--":
        break
      default:
        fail(`Unknown option: ${argument}`)
    }
  }

  return options
}

function normalizeUrl(rawValue, label) {
  let url
  try {
    url = new URL(rawValue)
  } catch {
    fail(`${label} must be a valid URL.`)
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    fail(`${label} must use http or https.`)
  }
  if (url.username || url.password || url.search || url.hash) {
    fail(`${label} cannot contain credentials, a query, or a hash.`)
  }

  return url.toString().replace(/\/+$/, "")
}

function validateOptions(options) {
  if (options.projectRef && !/^[a-z]{20}$/.test(options.projectRef)) {
    fail("The Supabase project ref must contain exactly 20 lowercase letters.")
  }

  if (
    !Number.isInteger(options.devPort) ||
    options.devPort < 1 ||
    options.devPort > 65535
  ) {
    fail("The development port must be between 1 and 65535.")
  }

  if (!options.supabaseUrl && options.projectRef) {
    options.supabaseUrl = `https://${options.projectRef}.supabase.co`
  }
  if (options.supabaseUrl) {
    options.supabaseUrl = normalizeUrl(options.supabaseUrl, "Supabase URL")
  }

  if (!options.siteUrl) {
    options.siteUrl = `http://localhost:${options.devPort}`
  }
  options.siteUrl = normalizeUrl(options.siteUrl, "Site URL")

  if (/[\r\n]/u.test(options.publishableKey)) {
    fail("The publishable key cannot contain line breaks.")
  }
  if (options.configureRemote && !options.projectRef) {
    fail("--configure-remote requires --project-ref.")
  }
}

async function managementRequest(projectRef, route, init = {}) {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  if (!accessToken) {
    fail("SUPABASE_ACCESS_TOKEN is required for hosted Supabase configuration.")
  }

  const apiBase = (
    process.env.SUPABASE_MANAGEMENT_API_URL ?? "https://api.supabase.com"
  ).replace(/\/+$/, "")
  const response = await fetch(
    `${apiBase}/v1/projects/${encodeURIComponent(projectRef)}${route}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    },
  )

  if (!response.ok) {
    const responseText = await response.text()
    const detail = responseText.trim().slice(0, 500)
    fail(
      `Supabase Management API returned ${response.status}${
        detail ? `: ${detail}` : ""
      }`,
    )
  }

  return response.json()
}

async function discoverPublishableKey(projectRef) {
  const keys = await managementRequest(projectRef, "/api-keys?reveal=true")
  if (!Array.isArray(keys)) {
    fail("Supabase returned an invalid API key response.")
  }

  const publishableKey = keys.find(
    (key) => key?.type === "publishable" && key?.api_key,
  )?.api_key
  if (!publishableKey) {
    fail(
      "No publishable key was found. Create one in Supabase or pass --publishable-key.",
    )
  }

  return publishableKey
}

function createRedirectUrls(siteUrl, devPort) {
  const origins = new Set([
    siteUrl,
    `http://localhost:${devPort}`,
    `http://127.0.0.1:${devPort}`,
  ])
  const redirects = []

  for (const origin of origins) {
    redirects.push(`${origin}/auth/confirm`, `${origin}/auth/callback`)
  }

  return redirects
}

async function configureRemoteAuth(options) {
  const [confirmationTemplate, magicLinkTemplate] = await Promise.all([
    readFile(path.join(projectRoot, "supabase/templates/confirmation.html"), "utf8"),
    readFile(path.join(projectRoot, "supabase/templates/magic_link.html"), "utf8"),
  ])

  const body = {
    site_url: options.siteUrl,
    uri_allow_list: createRedirectUrls(options.siteUrl, options.devPort).join(","),
    disable_signup: false,
    external_email_enabled: true,
    mailer_autoconfirm: false,
    mailer_otp_length: 6,
    mailer_otp_exp: 3600,
    mailer_secure_email_change_enabled: true,
    mailer_subjects_confirmation: "验证您的邮箱",
    mailer_templates_confirmation_content: confirmationTemplate,
    mailer_subjects_magic_link: "您的登录验证码",
    mailer_templates_magic_link_content: magicLinkTemplate,
    refresh_token_rotation_enabled: true,
    security_refresh_token_reuse_interval: 10,
    password_min_length: 6,
    security_update_password_require_reauthentication: false,
  }

  await managementRequest(options.projectRef, "/config/auth", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

function updateEnvironmentContent(current, values) {
  const lines = current ? current.replace(/\r\n/g, "\n").split("\n") : []
  const keys = Object.keys(values)
  const seen = new Set()
  const output = []

  for (const line of lines) {
    const matchedKey = keys.find((key) => new RegExp(`^\\s*${key}\\s*=`).test(line))
    if (matchedKey) {
      if (!seen.has(matchedKey)) {
        output.push(`${matchedKey}=${values[matchedKey]}`)
        seen.add(matchedKey)
      }
      continue
    }
    output.push(line)
  }

  for (const key of keys) {
    if (!seen.has(key)) {
      output.push(`${key}=${values[key]}`)
    }
  }

  while (output.at(-1) === "") {
    output.pop()
  }
  return `${output.join("\n")}\n`
}

async function writeEnvironmentFile(options) {
  const envPath = path.resolve(projectRoot, options.envFile)
  let current = ""

  try {
    current = await readFile(envPath, "utf8")
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error
    }
  }

  const next = updateEnvironmentContent(current, {
    NEXT_PUBLIC_SUPABASE_URL: options.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: options.publishableKey,
  })
  const temporaryPath = `${envPath}.${process.pid}.tmp`
  await writeFile(temporaryPath, next, { mode: 0o600 })
  await rename(temporaryPath, envPath)
  await chmod(envPath, 0o600)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  validateOptions(options)

  if (!options.publishableKey && options.projectRef) {
    options.publishableKey = await discoverPublishableKey(options.projectRef)
  }
  if (!options.supabaseUrl || !options.publishableKey) {
    fail(
      "Provide --project-ref with SUPABASE_ACCESS_TOKEN, or provide both --url and --publishable-key.",
    )
  }

  if (options.configureRemote) {
    await configureRemoteAuth(options)
  }
  await writeEnvironmentFile(options)

  process.stdout.write("Supabase configuration completed.\n")
  process.stdout.write(`  Environment: ${path.resolve(projectRoot, options.envFile)}\n`)
  process.stdout.write(`  URL:         ${options.supabaseUrl}\n`)
  process.stdout.write(
    `  Remote Auth: ${options.configureRemote ? "configured" : "unchanged"}\n`,
  )
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`)
  process.exit(1)
})
