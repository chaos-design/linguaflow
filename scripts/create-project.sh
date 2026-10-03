#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PACKAGE_NAME=""
TARGET_INPUT=""
DISPLAY_NAME=""
DESCRIPTION=""
AUTHOR=""
REPOSITORY=""
HOMEPAGE=""
BUGS_URL=""
LICENSE_ID="UNLICENSED"
VERSION="0.1.0"
BRAND_INITIALS=""
SUPABASE_PROJECT_ID=""
DEV_PORT="3000"
INSTALL_DEPENDENCIES=true
INIT_GIT=true
CREATE_COMMIT=false
STAGING_DIR=""

print_usage() {
  cat <<'USAGE'
Create a clean project from this scaffold.

Usage:
  ./scripts/create-project.sh --name <package-name> [options]

Required:
  --name <name>                 npm package name, for example acme-console

Project metadata:
  --target <path>               Destination directory (default: ../<package-name>)
  --display-name <name>         Product name shown in the UI
  --description <text>          package.json and page metadata description
  --author <text>               package.json author
  --repository <url>            package.json repository and Git origin
  --homepage <url>              package.json homepage
  --bugs-url <url>              package.json bugs.url
  --license <id>                SPDX license or UNLICENSED (default: UNLICENSED)
  --version <version>           Initial package version (default: 0.1.0)

Scaffold settings:
  --brand-initials <text>       Short brand mark; derived when omitted
  --supabase-project-id <id>    Local Supabase project ID
  --dev-port <port>             Local app and callback port (default: 3000)

Execution:
  --install                     Install dependencies (default)
  --no-install                  Skip dependency installation
  --git                         Initialize a clean Git repository (default)
  --no-git                      Do not initialize Git
  --commit                      Create the first commit after Git initialization
  -h, --help                    Show this help

The script never copies .git, .env files, dependencies, build output, editor
state, or local Supabase state. It creates .env.local from .env.example with
empty values.
USAGE
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_value() {
  local option="$1"
  local value="${2:-}"

  if [[ -z "$value" ]]; then
    fail "$option requires a value."
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

cleanup_staging() {
  if [[ -n "$STAGING_DIR" && -d "$STAGING_DIR" ]]; then
    rm -rf -- "$STAGING_DIR"
  fi
}

trap cleanup_staging EXIT INT TERM

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      require_value "$1" "${2:-}"
      PACKAGE_NAME="$2"
      shift 2
      ;;
    --target)
      require_value "$1" "${2:-}"
      TARGET_INPUT="$2"
      shift 2
      ;;
    --display-name)
      require_value "$1" "${2:-}"
      DISPLAY_NAME="$2"
      shift 2
      ;;
    --description)
      require_value "$1" "${2:-}"
      DESCRIPTION="$2"
      shift 2
      ;;
    --author)
      require_value "$1" "${2:-}"
      AUTHOR="$2"
      shift 2
      ;;
    --repository)
      require_value "$1" "${2:-}"
      REPOSITORY="$2"
      shift 2
      ;;
    --homepage)
      require_value "$1" "${2:-}"
      HOMEPAGE="$2"
      shift 2
      ;;
    --bugs-url)
      require_value "$1" "${2:-}"
      BUGS_URL="$2"
      shift 2
      ;;
    --license)
      require_value "$1" "${2:-}"
      LICENSE_ID="$2"
      shift 2
      ;;
    --version)
      require_value "$1" "${2:-}"
      VERSION="$2"
      shift 2
      ;;
    --brand-initials)
      require_value "$1" "${2:-}"
      BRAND_INITIALS="$2"
      shift 2
      ;;
    --supabase-project-id)
      require_value "$1" "${2:-}"
      SUPABASE_PROJECT_ID="$2"
      shift 2
      ;;
    --dev-port)
      require_value "$1" "${2:-}"
      DEV_PORT="$2"
      shift 2
      ;;
    --install)
      INSTALL_DEPENDENCIES=true
      shift
      ;;
    --no-install)
      INSTALL_DEPENDENCIES=false
      shift
      ;;
    --git)
      INIT_GIT=true
      shift
      ;;
    --no-git)
      INIT_GIT=false
      shift
      ;;
    --commit)
      CREATE_COMMIT=true
      shift
      ;;
    --)
      shift
      ;;
    -h | --help)
      print_usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1. Run with --help for usage."
      ;;
  esac
done

[[ -n "$PACKAGE_NAME" ]] || fail "--name is required."
[[ -f "$SOURCE_DIR/package.json" ]] || fail "package.json was not found in $SOURCE_DIR."
[[ -f "$SOURCE_DIR/scaffold.config.json" ]] ||
  fail "scaffold.config.json was not found in $SOURCE_DIR."

if [[ "$CREATE_COMMIT" == true && "$INIT_GIT" != true ]]; then
  fail "--commit cannot be used with --no-git."
fi

command_exists node || fail "Node.js 20 or newer is required."
command_exists rsync || fail "rsync is required."

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if ((NODE_MAJOR < 20)); then
  fail "Node.js 20 or newer is required; found $(node --version)."
fi

DISPLAY_NAME="${DISPLAY_NAME:-$PACKAGE_NAME}"
DESCRIPTION="${DESCRIPTION:-A Next.js and Supabase application.}"
UNSCOPED_NAME="${PACKAGE_NAME##*/}"
SUPABASE_PROJECT_ID="${SUPABASE_PROJECT_ID:-$UNSCOPED_NAME}"

if [[ -z "$BRAND_INITIALS" ]]; then
  BRAND_INITIALS="$(
    DISPLAY_NAME="$DISPLAY_NAME" node <<'NODE'
const displayName = process.env.DISPLAY_NAME.trim()
const words = displayName.match(/[\p{L}\p{N}]+/gu) ?? []
let initials = words.slice(0, 2).map((word) => Array.from(word)[0]).join("/")

if (words.length === 1) {
  initials = Array.from(words[0]).slice(0, 2).join("/")
}

process.stdout.write((initials || "APP").toUpperCase())
NODE
  )"
fi

PACKAGE_NAME="$PACKAGE_NAME" \
  DISPLAY_NAME="$DISPLAY_NAME" \
  DESCRIPTION="$DESCRIPTION" \
  AUTHOR="$AUTHOR" \
  REPOSITORY="$REPOSITORY" \
  HOMEPAGE="$HOMEPAGE" \
  BUGS_URL="$BUGS_URL" \
  LICENSE_ID="$LICENSE_ID" \
  VERSION="$VERSION" \
  BRAND_INITIALS="$BRAND_INITIALS" \
  SUPABASE_PROJECT_ID="$SUPABASE_PROJECT_ID" \
  DEV_PORT="$DEV_PORT" \
  node <<'NODE'
const values = process.env

function invalid(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

const packageNamePattern =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
if (
  !packageNamePattern.test(values.PACKAGE_NAME) ||
  values.PACKAGE_NAME.length > 214
) {
  invalid("The package name must be a valid lowercase npm package name.")
}

if (/["\\<>{}\r\n]/u.test(values.DISPLAY_NAME)) {
  invalid('The display name cannot contain ", \\, <, >, {, }, or line breaks.')
}

if (!values.DISPLAY_NAME.trim()) {
  invalid("The display name cannot be empty.")
}

if (/[\r\n]/u.test(values.DESCRIPTION)) {
  invalid("The description must be a single line.")
}

if (/[\r\n]/u.test(values.AUTHOR)) {
  invalid("The author must be a single line.")
}

for (const key of ["REPOSITORY", "HOMEPAGE", "BUGS_URL"]) {
  if (/[\r\n]/u.test(values[key])) {
    invalid(`${key.toLowerCase()} must be a single line.`)
  }
  if (values[key].startsWith("-")) {
    invalid(`${key.toLowerCase()} cannot start with a hyphen.`)
  }
}

if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
  values.VERSION,
)) {
  invalid("The version must be a valid semantic version.")
}

if (!values.LICENSE_ID || /[\r\n]/u.test(values.LICENSE_ID)) {
  invalid("The license must be a non-empty single-line value.")
}

if (
  !/^[a-z0-9][a-z0-9_-]*$/.test(values.SUPABASE_PROJECT_ID) ||
  values.SUPABASE_PROJECT_ID.length > 63
) {
  invalid(
    "The Supabase project ID must use lowercase letters, numbers, hyphens, or underscores.",
  )
}

if (
  !/^[0-9]+$/.test(values.DEV_PORT) ||
  Number(values.DEV_PORT) < 1 ||
  Number(values.DEV_PORT) > 65535
) {
  invalid("The development port must be between 1 and 65535.")
}

if (
  !values.BRAND_INITIALS ||
  Array.from(values.BRAND_INITIALS).length > 8 ||
  /["\\<>{}&\r\n]/u.test(values.BRAND_INITIALS)
) {
  invalid(
    'Brand initials must be 1-8 characters and cannot contain ", \\, <, >, {, }, or &.',
  )
}
NODE

if [[ -z "$TARGET_INPUT" ]]; then
  TARGET_INPUT="$SOURCE_DIR/../$UNSCOPED_NAME"
fi

TARGET_DIR="$(
  node -e 'const path = require("node:path"); process.stdout.write(path.resolve(process.argv[1]))' \
    "$TARGET_INPUT"
)"

if [[ "$TARGET_DIR" == "$SOURCE_DIR" || "$TARGET_DIR" == "$SOURCE_DIR/"* ]]; then
  fail "The target must be outside the scaffold source directory."
fi

if [[ -e "$TARGET_DIR" ]]; then
  fail "The target already exists: $TARGET_DIR"
fi

if [[ "$INSTALL_DEPENDENCIES" == true ]]; then
  command_exists pnpm || fail "pnpm is required unless --no-install is used."
fi

if [[ "$INIT_GIT" == true ]]; then
  command_exists git || fail "Git is required unless --no-git is used."
fi

TARGET_PARENT="$(dirname "$TARGET_DIR")"
TARGET_BASENAME="$(basename "$TARGET_DIR")"
mkdir -p "$TARGET_PARENT"
STAGING_DIR="$(mktemp -d "$TARGET_PARENT/.${TARGET_BASENAME}.tmp.XXXXXX")"

printf 'Copying scaffold to a clean staging directory...\n'
rsync -a \
  --include='/.env.example' \
  --exclude='/.env' \
  --exclude='/.env.*' \
  --exclude='/.git/' \
  --exclude='/.github/.cache/' \
  --exclude='/.idea/' \
  --exclude='/.next/' \
  --exclude='/.next-dev/' \
  --exclude='/.supabase/' \
  --exclude='/.trae/' \
  --exclude='/.turbo/' \
  --exclude='/.vercel/' \
  --exclude='/.vscode/' \
  --exclude='/build/' \
  --exclude='/coverage/' \
  --exclude='/node_modules/' \
  --exclude='/out/' \
  --exclude='/supabase/.branches/' \
  --exclude='/supabase/.temp/' \
  --exclude='/test-results/' \
  --exclude='*.log' \
  --exclude='*.tsbuildinfo' \
  --exclude='.DS_Store' \
  "$SOURCE_DIR/" "$STAGING_DIR/"

TARGET_DIR="$STAGING_DIR" \
  PACKAGE_NAME="$PACKAGE_NAME" \
  DISPLAY_NAME="$DISPLAY_NAME" \
  DESCRIPTION="$DESCRIPTION" \
  AUTHOR="$AUTHOR" \
  REPOSITORY="$REPOSITORY" \
  HOMEPAGE="$HOMEPAGE" \
  BUGS_URL="$BUGS_URL" \
  LICENSE_ID="$LICENSE_ID" \
  VERSION="$VERSION" \
  BRAND_INITIALS="$BRAND_INITIALS" \
  SUPABASE_PROJECT_ID="$SUPABASE_PROJECT_ID" \
  DEV_PORT="$DEV_PORT" \
  node <<'NODE'
const fs = require("node:fs")
const path = require("node:path")

const targetDir = process.env.TARGET_DIR
const packagePath = path.join(targetDir, "package.json")
const scaffoldConfigPath = path.join(targetDir, "scaffold.config.json")
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"))
const scaffoldConfig = JSON.parse(fs.readFileSync(scaffoldConfigPath, "utf8"))
const oldPackageName = scaffoldConfig.packageName || packageJson.name
const oldDisplayName = scaffoldConfig.displayName || oldPackageName
const oldBrandInitials = scaffoldConfig.brandInitials || ""

function replaceLiteral(value, search, replacement) {
  if (!search || search === replacement) {
    return value
  }
  return value.split(search).join(replacement)
}

function updateTextFile(relativePath, transform) {
  const filePath = path.join(targetDir, relativePath)
  if (!fs.existsSync(filePath)) {
    return
  }
  const current = fs.readFileSync(filePath, "utf8")
  fs.writeFileSync(filePath, transform(current))
}

packageJson.name = process.env.PACKAGE_NAME
packageJson.version = process.env.VERSION
packageJson.private = true
packageJson.description = process.env.DESCRIPTION
packageJson.license = process.env.LICENSE_ID

for (const field of [
  "author",
  "contributors",
  "repository",
  "homepage",
  "bugs",
  "funding",
]) {
  delete packageJson[field]
}

if (process.env.AUTHOR) {
  packageJson.author = process.env.AUTHOR
}
if (process.env.REPOSITORY) {
  packageJson.repository = {
    type: "git",
    url: process.env.REPOSITORY,
  }
}
if (process.env.HOMEPAGE) {
  packageJson.homepage = process.env.HOMEPAGE
}
if (process.env.BUGS_URL) {
  packageJson.bugs = {
    url: process.env.BUGS_URL,
  }
}

fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

const brandedSourceFiles = [
  "src/app/layout.tsx",
  "src/app/login/page.tsx",
  "src/app/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/workspace/page.tsx",
  "src/components/brand.tsx",
]

for (const relativePath of brandedSourceFiles) {
  updateTextFile(relativePath, (current) => {
    let next = replaceLiteral(
      current,
      oldDisplayName,
      process.env.DISPLAY_NAME,
    )
    next = replaceLiteral(next, oldPackageName, process.env.DISPLAY_NAME)
    if (oldBrandInitials) {
      next = replaceLiteral(
        next,
        `>${oldBrandInitials}<`,
        `>${process.env.BRAND_INITIALS}<`,
      )
    }
    return next
  })
}

for (const relativePath of [
  "README.md",
  "README.en.md",
  "docs/style-guide.md",
  "docs/style-guide.en.md",
]) {
  updateTextFile(relativePath, (current) => {
    let next = replaceLiteral(
      current,
      oldDisplayName,
      process.env.DISPLAY_NAME,
    )
    next = replaceLiteral(next, oldPackageName, process.env.DISPLAY_NAME)
    return next
  })
}

updateTextFile("src/app/layout.tsx", (current) => {
  const descriptionPattern =
    /^(\s*description:\s*)"(?:\\.|[^"\\])*"(,?)$/m
  if (!descriptionPattern.test(current)) {
    throw new Error("Could not locate root page metadata description.")
  }
  return current.replace(
    descriptionPattern,
    `$1${JSON.stringify(process.env.DESCRIPTION)}$2`,
  )
})

updateTextFile("supabase/config.toml", (current) => {
  let next = current.replace(
    /^project_id\s*=\s*".*"$/m,
    `project_id = "${process.env.SUPABASE_PROJECT_ID}"`,
  )
  next = next.replace(
    /http:\/\/localhost:[0-9]+/g,
    `http://localhost:${process.env.DEV_PORT}`,
  )
  next = next.replace(
    /http:\/\/127\.0\.0\.1:[0-9]+/g,
    `http://127.0.0.1:${process.env.DEV_PORT}`,
  )
  return next
})

const nextScaffoldConfig = {
  packageName: process.env.PACKAGE_NAME,
  displayName: process.env.DISPLAY_NAME,
  brandInitials: process.env.BRAND_INITIALS,
  description: process.env.DESCRIPTION,
  supabaseProjectId: process.env.SUPABASE_PROJECT_ID,
  devPort: Number(process.env.DEV_PORT),
}
fs.writeFileSync(
  scaffoldConfigPath,
  `${JSON.stringify(nextScaffoldConfig, null, 2)}\n`,
)
NODE

if [[ -f "$STAGING_DIR/.env.example" ]]; then
  cp "$STAGING_DIR/.env.example" "$STAGING_DIR/.env.local"
fi

mv "$STAGING_DIR" "$TARGET_DIR"
STAGING_DIR=""

if [[ "$INSTALL_DEPENDENCIES" == true ]]; then
  printf 'Installing dependencies with the lockfile...\n'
  if [[ -f "$TARGET_DIR/pnpm-lock.yaml" ]]; then
    (cd "$TARGET_DIR" && pnpm install --frozen-lockfile)
  else
    (cd "$TARGET_DIR" && pnpm install)
  fi
fi

if [[ "$INIT_GIT" == true ]]; then
  printf 'Initializing a clean Git repository...\n'
  if ! (cd "$TARGET_DIR" && git init -b main >/dev/null 2>&1); then
    (cd "$TARGET_DIR" && git init >/dev/null && git branch -M main)
  fi

  if [[ -n "$REPOSITORY" ]]; then
    REMOTE_URL="${REPOSITORY#git+}"
    (cd "$TARGET_DIR" && git remote add origin "$REMOTE_URL")
  fi

  if [[ "$CREATE_COMMIT" == true ]]; then
    (
      cd "$TARGET_DIR"
      git add .
      git commit -m "chore: initialize $PACKAGE_NAME"
    )
  fi
fi

printf '\nProject created successfully.\n'
printf '  Directory: %s\n' "$TARGET_DIR"
printf '  Package:   %s\n' "$PACKAGE_NAME"
printf '  Product:   %s\n' "$DISPLAY_NAME"
printf '  Supabase:  %s\n' "$SUPABASE_PROJECT_ID"
printf '\nNext steps:\n'
printf '  cd %q\n' "$TARGET_DIR"
if [[ "$INSTALL_DEPENDENCIES" != true ]]; then
  printf '  pnpm install --frozen-lockfile\n'
fi
printf '  # Fill in .env.local, then run:\n'
printf '  pnpm check\n'
printf '  pnpm build\n'
printf '  pnpm dev  # http://localhost:%s\n' "$DEV_PORT"
