#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PACKAGE_NAME=""
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
SUPABASE_PROJECT_REF=""
SUPABASE_URL=""
SUPABASE_PUBLISHABLE_KEY=""
SITE_URL=""
DEV_PORT="3000"
INSTALL_DEPENDENCIES=true
CONFIGURE_REMOTE="auto"
LINK_SUPABASE="auto"
PUSH_DATABASE=false
RUN_CHECK=true
RUN_BUILD=false
RESET_GIT=false
CREATE_COMMIT=false
TEMP_ROOT=""

print_usage() {
  cat <<'USAGE'
Configure a fresh clone of this scaffold in place.

Usage:
  ./scripts/setup-project.sh --name <package-name> [options]

Required project metadata:
  --name <name>                    Lowercase npm package name

Project metadata:
  --display-name <name>            Product name shown in the UI
  --description <text>             Package and page description
  --author <text>                  Package author
  --repository <url>               Package repository and Git origin
  --homepage <url>                 Package homepage
  --bugs-url <url>                 Package issue tracker
  --license <id>                   SPDX license or UNLICENSED
  --version <version>              Initial version (default: 0.1.0)
  --brand-initials <text>          Short brand mark
  --dev-port <port>                Local application port (default: 3000)

Supabase:
  --supabase-project-ref <ref>     Hosted project ref
  --supabase-url <url>             Hosted project URL
  --supabase-publishable-key <key> Public browser key
  --supabase-project-id <id>       Local CLI project ID
  --site-url <url>                 Primary hosted Auth site URL
  --configure-supabase             Configure hosted Auth and email templates
  --no-configure-supabase          Do not change hosted Auth
  --link-supabase                  Link the local CLI project
  --no-link-supabase               Do not link the local CLI project
  --push-database                  Apply committed migrations after linking

Execution:
  --install / --no-install         Toggle dependency installation (default: install)
  --check / --no-check             Toggle pnpm check (default: check)
  --build                          Run a production build
  --reset-git                      Remove inherited history and initialize main
  --commit                         Create an initialization commit
  -h, --help                       Show this help

Hosted one-command setup:
  SUPABASE_ACCESS_TOKEN=sbp_... ./scripts/setup-project.sh \
    --name my-project \
    --display-name "My Project" \
    --supabase-project-ref abcdefghijklmnopqrst \
    --site-url https://app.example.com \
    --repository git@github.com:org/my-project.git \
    --reset-git --commit --build

SUPABASE_ACCESS_TOKEN and optional SUPABASE_DB_PASSWORD are read from the
environment and never written to project files.
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

cleanup() {
  if [[ -n "$TEMP_ROOT" && -d "$TEMP_ROOT" ]]; then
    rm -rf -- "$TEMP_ROOT"
  fi
}

trap cleanup EXIT INT TERM

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      require_value "$1" "${2:-}"
      PACKAGE_NAME="$2"
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
    --dev-port)
      require_value "$1" "${2:-}"
      DEV_PORT="$2"
      shift 2
      ;;
    --supabase-project-id)
      require_value "$1" "${2:-}"
      SUPABASE_PROJECT_ID="$2"
      shift 2
      ;;
    --supabase-project-ref)
      require_value "$1" "${2:-}"
      SUPABASE_PROJECT_REF="$2"
      shift 2
      ;;
    --supabase-url)
      require_value "$1" "${2:-}"
      SUPABASE_URL="$2"
      shift 2
      ;;
    --supabase-publishable-key)
      require_value "$1" "${2:-}"
      SUPABASE_PUBLISHABLE_KEY="$2"
      shift 2
      ;;
    --site-url)
      require_value "$1" "${2:-}"
      SITE_URL="$2"
      shift 2
      ;;
    --configure-supabase)
      CONFIGURE_REMOTE=true
      shift
      ;;
    --no-configure-supabase)
      CONFIGURE_REMOTE=false
      shift
      ;;
    --link-supabase)
      LINK_SUPABASE=true
      shift
      ;;
    --no-link-supabase)
      LINK_SUPABASE=false
      shift
      ;;
    --push-database)
      PUSH_DATABASE=true
      shift
      ;;
    --install)
      INSTALL_DEPENDENCIES=true
      shift
      ;;
    --no-install)
      INSTALL_DEPENDENCIES=false
      shift
      ;;
    --check)
      RUN_CHECK=true
      shift
      ;;
    --no-check)
      RUN_CHECK=false
      shift
      ;;
    --build)
      RUN_BUILD=true
      shift
      ;;
    --reset-git)
      RESET_GIT=true
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
[[ -x "$PROJECT_DIR/scripts/create-project.sh" ]] ||
  fail "scripts/create-project.sh is missing or not executable."
[[ -f "$PROJECT_DIR/scripts/configure-supabase.mjs" ]] ||
  fail "scripts/configure-supabase.mjs is missing."

if [[ "$CREATE_COMMIT" == true && "$RESET_GIT" != true && ! -d "$PROJECT_DIR/.git" ]]; then
  fail "--commit requires an existing Git repository or --reset-git."
fi

if [[ -z "$SUPABASE_PROJECT_REF" && -z "$SUPABASE_URL" ]]; then
  fail "Provide --supabase-project-ref or --supabase-url."
fi
if [[ -z "$SUPABASE_PROJECT_REF" && -z "$SUPABASE_PUBLISHABLE_KEY" ]]; then
  fail "--supabase-url also requires --supabase-publishable-key."
fi

if [[ "$CONFIGURE_REMOTE" == auto ]]; then
  if [[ -n "$SUPABASE_PROJECT_REF" && -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    CONFIGURE_REMOTE=true
  else
    CONFIGURE_REMOTE=false
  fi
fi
if [[ "$LINK_SUPABASE" == auto ]]; then
  if [[ -n "$SUPABASE_PROJECT_REF" && -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    LINK_SUPABASE=true
  else
    LINK_SUPABASE=false
  fi
fi

if [[ "$CONFIGURE_REMOTE" == true && -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  fail "--configure-supabase requires SUPABASE_ACCESS_TOKEN."
fi
if [[ "$LINK_SUPABASE" == true && -z "$SUPABASE_PROJECT_REF" ]]; then
  fail "--link-supabase requires --supabase-project-ref."
fi
if [[ "$LINK_SUPABASE" == true && -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  fail "--link-supabase requires SUPABASE_ACCESS_TOKEN."
fi
if [[ "$INSTALL_DEPENDENCIES" != true && "$LINK_SUPABASE" == true ]]; then
  fail "--link-supabase requires dependency installation."
fi
if [[ "$PUSH_DATABASE" == true && "$LINK_SUPABASE" != true ]]; then
  fail "--push-database requires Supabase linking."
fi

GENERATOR_ARGS=(
  --name "$PACKAGE_NAME"
  --license "$LICENSE_ID"
  --version "$VERSION"
  --dev-port "$DEV_PORT"
  --no-install
  --no-git
)

if [[ -n "$DISPLAY_NAME" ]]; then
  GENERATOR_ARGS+=(--display-name "$DISPLAY_NAME")
fi
if [[ -n "$DESCRIPTION" ]]; then
  GENERATOR_ARGS+=(--description "$DESCRIPTION")
fi
if [[ -n "$AUTHOR" ]]; then
  GENERATOR_ARGS+=(--author "$AUTHOR")
fi
if [[ -n "$REPOSITORY" ]]; then
  GENERATOR_ARGS+=(--repository "$REPOSITORY")
fi
if [[ -n "$HOMEPAGE" ]]; then
  GENERATOR_ARGS+=(--homepage "$HOMEPAGE")
fi
if [[ -n "$BUGS_URL" ]]; then
  GENERATOR_ARGS+=(--bugs-url "$BUGS_URL")
fi
if [[ -n "$BRAND_INITIALS" ]]; then
  GENERATOR_ARGS+=(--brand-initials "$BRAND_INITIALS")
fi
if [[ -n "$SUPABASE_PROJECT_ID" ]]; then
  GENERATOR_ARGS+=(--supabase-project-id "$SUPABASE_PROJECT_ID")
fi

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/next-supabase-setup.XXXXXX")"
GENERATED_DIR="$TEMP_ROOT/project"

printf 'Applying project metadata and branding...\n'
"$PROJECT_DIR/scripts/create-project.sh" \
  "${GENERATOR_ARGS[@]}" \
  --target "$GENERATED_DIR"

rsync -a \
  --exclude='/.env.local' \
  --exclude='/.git/' \
  --exclude='/.next/' \
  --exclude='/.next-dev/' \
  --exclude='/node_modules/' \
  --exclude='*.tsbuildinfo' \
  "$GENERATED_DIR/" "$PROJECT_DIR/"

SUPABASE_ARGS=(
  --dev-port "$DEV_PORT"
  --output-env-file .env.local
)
if [[ -n "$SUPABASE_PROJECT_REF" ]]; then
  SUPABASE_ARGS+=(--project-ref "$SUPABASE_PROJECT_REF")
fi
if [[ -n "$SUPABASE_URL" ]]; then
  SUPABASE_ARGS+=(--url "$SUPABASE_URL")
fi
if [[ -n "$SUPABASE_PUBLISHABLE_KEY" ]]; then
  SUPABASE_ARGS+=(--publishable-key "$SUPABASE_PUBLISHABLE_KEY")
fi
if [[ -n "$SITE_URL" ]]; then
  SUPABASE_ARGS+=(--site-url "$SITE_URL")
fi
if [[ "$CONFIGURE_REMOTE" == true ]]; then
  SUPABASE_ARGS+=(--configure-remote)
else
  SUPABASE_ARGS+=(--no-configure-remote)
fi

printf 'Configuring Supabase environment and Auth...\n'
node "$PROJECT_DIR/scripts/configure-supabase.mjs" "${SUPABASE_ARGS[@]}"

if [[ "$INSTALL_DEPENDENCIES" == true ]]; then
  printf 'Installing dependencies with the lockfile...\n'
  (cd "$PROJECT_DIR" && pnpm install --frozen-lockfile)
fi

if [[ "$LINK_SUPABASE" == true ]]; then
  printf 'Linking the Supabase CLI project...\n'
  if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
    (
      cd "$PROJECT_DIR"
      pnpm exec supabase link \
        --project-ref "$SUPABASE_PROJECT_REF" \
        --password "$SUPABASE_DB_PASSWORD"
    )
  else
    (
      cd "$PROJECT_DIR"
      pnpm exec supabase link --project-ref "$SUPABASE_PROJECT_REF" </dev/null
    )
  fi
fi

if [[ "$PUSH_DATABASE" == true ]]; then
  printf 'Applying committed Supabase database migrations...\n'
  (cd "$PROJECT_DIR" && pnpm exec supabase db push --linked --yes)
fi

if [[ "$RUN_CHECK" == true ]]; then
  printf 'Running project checks...\n'
  (cd "$PROJECT_DIR" && pnpm check)
fi
if [[ "$RUN_BUILD" == true ]]; then
  printf 'Running the production build...\n'
  (cd "$PROJECT_DIR" && pnpm build)
fi

if [[ "$RESET_GIT" == true ]]; then
  printf 'Replacing inherited Git history...\n'
  GIT_USER_NAME="$(cd "$PROJECT_DIR" && git config user.name 2>/dev/null || true)"
  GIT_USER_EMAIL="$(cd "$PROJECT_DIR" && git config user.email 2>/dev/null || true)"
  rm -rf -- "$PROJECT_DIR/.git"
  if ! (cd "$PROJECT_DIR" && git init -b main >/dev/null 2>&1); then
    (cd "$PROJECT_DIR" && git init >/dev/null && git branch -M main)
  fi
  if [[ -n "$GIT_USER_NAME" ]]; then
    (cd "$PROJECT_DIR" && git config user.name "$GIT_USER_NAME")
  fi
  if [[ -n "$GIT_USER_EMAIL" ]]; then
    (cd "$PROJECT_DIR" && git config user.email "$GIT_USER_EMAIL")
  fi
fi

if [[ -n "$REPOSITORY" ]]; then
  REMOTE_URL="${REPOSITORY#git+}"
  if (cd "$PROJECT_DIR" && git remote get-url origin >/dev/null 2>&1); then
    (cd "$PROJECT_DIR" && git remote set-url origin "$REMOTE_URL")
  else
    (cd "$PROJECT_DIR" && git remote add origin "$REMOTE_URL")
  fi
fi

if [[ "$CREATE_COMMIT" == true ]]; then
  (
    cd "$PROJECT_DIR"
    git add .
    git commit -m "chore: initialize $PACKAGE_NAME"
  )
fi

printf '\nProject setup completed.\n'
printf '  Directory:   %s\n' "$PROJECT_DIR"
printf '  Package:     %s\n' "$PACKAGE_NAME"
printf '  Supabase:    %s\n' "${SUPABASE_PROJECT_REF:-$SUPABASE_URL}"
printf '  Remote Auth: %s\n' "$CONFIGURE_REMOTE"
printf '  CLI linked:  %s\n' "$LINK_SUPABASE"
printf '\nRun pnpm dev and open http://localhost:%s.\n' "$DEV_PORT"
