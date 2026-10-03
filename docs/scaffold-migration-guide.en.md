# Scaffold Privatization and Project Creation Guide

[中文](./scaffold-migration-guide.md)

This guide explains how to turn this Next.js + Supabase scaffold into a private,
reusable team template and how to create clean projects from that template.

Use [`scripts/create-project.sh`](../scripts/create-project.sh) for the recommended
workflow. It always generates a new directory. It does not modify the source in
place or copy Git history, local environment values, dependencies, or build output.

For a repository already cloned into its destination, use
[`scripts/setup-project.sh`](../scripts/setup-project.sh) to configure metadata,
branding, Supabase, dependencies, checks, and Git in place.

## 0. One-Command Setup After Clone

Create a Supabase Personal Access Token under Account Tokens and obtain the
20-character Project Ref from the Dashboard or project URL:

```bash
git clone git@github.com:your-org/your-starter.git my-project
cd my-project

read -s SUPABASE_ACCESS_TOKEN
export SUPABASE_ACCESS_TOKEN

pnpm setup:project -- \
  --name my-project \
  --display-name "My Project" \
  --description "My Next.js and Supabase application." \
  --author "Your Team" \
  --repository "git@github.com:your-org/my-project.git" \
  --homepage "https://app.example.com" \
  --bugs-url "https://github.com/your-org/my-project/issues" \
  --brand-initials "M/P" \
  --supabase-project-ref abcdefghijklmnopqrst \
  --supabase-project-id my-project \
  --site-url "https://app.example.com" \
  --dev-port 3000 \
  --reset-git \
  --commit \
  --build

unset SUPABASE_ACCESS_TOKEN
```

This command updates project metadata and branding, writes a `0600`
`.env.local`, discovers the Publishable key, configures hosted Email Auth and
templates, links the project-scoped Supabase CLI, installs dependencies, runs
checks, and optionally builds. PAT and optional `SUPABASE_DB_PASSWORD` values are
read only from the environment and are never written to project files.

For a local-only setup without Management API access:

```bash
pnpm setup:project -- \
  --name my-project \
  --display-name "My Project" \
  --supabase-url "https://your-project.supabase.co" \
  --supabase-publishable-key "sb_publishable_..." \
  --no-configure-supabase \
  --no-link-supabase
```

Database changes are disabled by default. Add `--push-database` only when the
private starter contains reviewed `supabase/migrations/` that should be deployed.
Run `./scripts/setup-project.sh --help` for the full option list.

## 1. Project Boundaries

### Stable infrastructure to retain

| Path | Responsibility | Migration rule |
| --- | --- | --- |
| `src/features/auth/` | Login, registration, email code, recovery, and reset UI | Keep validation, states, feedback, and accessibility |
| `src/lib/supabase/` | Browser, server, and Proxy clients | Use only the public URL and Publishable key |
| `src/server/auth/` | Server user lookup, confirmation feedback, safe redirects | Keep `sanitizeRedirectPath` on every return path |
| `src/proxy.ts` | Session refresh and private route protection | Update the matcher when adding private route groups |
| `src/app/auth/` | Email confirmation and recovery callbacks | Preserve server verification and same-origin redirects |
| `src/features/auth/auth-form-config.ts` | Shared auth field constraints | Reuse it for new authentication forms |
| `supabase/templates/` | Local confirmation and code templates | Hosted templates still require Dashboard setup |

### Product-specific areas to replace

| Path | Current purpose | Required work |
| --- | --- | --- |
| `src/app/page.tsx` | Scaffold overview | Replace with the product entry point |
| `src/app/workspace/page.tsx` | Private sample workspace | Replace with the product while keeping the server user check |
| `src/components/brand.tsx` | Default name and `N/S` mark | Set the product name, initials, and accessible label |
| `src/app/layout.tsx` | Default title and description | Set product metadata |
| `src/app/login/page.tsx` | Scaffold-oriented auth shell | Rebrand without removing auth behavior |
| `src/app/terms/page.tsx` | Terms template | Add the actual operator, jurisdiction, contact, and effective date |
| `src/app/privacy/page.tsx` | Privacy template | Add real processing purposes, vendors, retention, and rights |
| `supabase/schema.sql` | Data design checklist | Add tables, constraints, indexes, RLS, and field mappings |
| `README.md`, `README.en.md` | Scaffold documentation | Document the product, deployment, and team workflow |
| `AGENTS.md` | Scaffold engineering boundaries | Add stable domain rules after the architecture is known |

## 2. Configuration Inventory

### Required changes

| File or platform | Setting | Notes |
| --- | --- | --- |
| `package.json` | `name` | Lowercase npm name; scopes are supported |
| `package.json` | `version` | New applications normally start at `0.1.0` |
| `package.json` | `description` | One-line project purpose |
| `package.json` | `author` | Person, team, or organization |
| `package.json` | `repository` | The new repository, not the scaffold repository |
| `package.json` | `homepage`, `bugs` | Optional product and issue URLs |
| `package.json` | `license`, `private` | Private apps should normally use `UNLICENSED` and `private: true` |
| `scaffold.config.json` | All fields | Records the current template identity for repeat generation |
| `supabase/config.toml` | `project_id` | Distinguishes local Supabase projects |
| `supabase/config.toml` | Site and callback URLs | Keep them aligned with the local application port |
| `.env.local` | Two public Supabase variables | Use a separate Supabase project for each application |
| Supabase Dashboard | Site URL and Redirect URLs | Hosted projects do not read the local TOML file |

The TypeScript, Biome, PostCSS, shadcn, and Next.js settings can normally remain
unchanged. Keep the security headers in `next.config.ts`. Change
`pnpm-workspace.yaml` only when converting the repository into a monorepo.

## 3. Prerequisites

- Node.js 20 or newer.
- pnpm 11; `packageManager` currently pins `pnpm@11.21.0`.
- Git.
- `rsync`.
- A new Supabase project.
- Docker and Supabase CLI only when running Supabase locally.

Verify the environment:

```bash
node --version
pnpm --version
git --version
rsync --version
```

Activate the repository pnpm version with Corepack:

```bash
corepack enable
corepack prepare pnpm@11.21.0 --activate
```

## 4. Recommended Two-Level Workflow

First generate a private team starter, such as `acme-next-starter`. Use that
private starter to generate concrete applications later. Generated projects keep
the script and `scaffold.config.json`, so they can also become reusable upstream
templates.

### Create the private team starter

Run from this repository:

```bash
./scripts/create-project.sh \
  --name acme-next-starter \
  --display-name "Acme Next Starter" \
  --description "The Acme Next.js and Supabase application starter." \
  --author "Acme Engineering" \
  --repository "git@github.com:acme/acme-next-starter.git" \
  --homepage "https://github.com/acme/acme-next-starter" \
  --bugs-url "https://github.com/acme/acme-next-starter/issues" \
  --brand-initials "A/S" \
  --supabase-project-id acme-next-starter \
  --no-install \
  --commit
```

`--commit` requires configured Git author details. Omit it to create a clean,
empty repository without making the first commit.

Review the generated README files, legal pages, homepage, workspace, and
`AGENTS.md` before publishing the private template. Never add live credentials to
the template.

### Create a product from the private starter

```bash
./scripts/create-project.sh \
  --name billing-console \
  --target ../billing-console \
  --display-name "Billing Console" \
  --description "Internal billing review and settlement console." \
  --author "Acme Finance Platform" \
  --repository "git@github.com:acme/billing-console.git" \
  --homepage "https://billing.example.com" \
  --bugs-url "https://github.com/acme/billing-console/issues" \
  --license UNLICENSED \
  --version 0.1.0 \
  --brand-initials "B/C" \
  --supabase-project-id billing-console \
  --dev-port 3000 \
  --install \
  --commit
```

The pnpm shortcut is also available:

```bash
pnpm create:project -- \
  --name billing-console \
  --display-name "Billing Console" \
  --no-install
```

## 5. Script Reference

Run `./scripts/create-project.sh --help` for the authoritative option list.

| Option | Default | Purpose |
| --- | --- | --- |
| `--name` | Required | npm package name |
| `--target` | `../<unscoped-name>` | Destination directory |
| `--display-name` | Package name | Product name used in the UI and docs |
| `--description` | Generic description | Package and root page description |
| `--author` | Empty | Package author; stale upstream values are removed |
| `--repository` | Empty | Package repository and Git origin |
| `--homepage` | Empty | Product homepage |
| `--bugs-url` | Empty | Issue tracker URL |
| `--license` | `UNLICENSED` | Package license |
| `--version` | `0.1.0` | Initial package version |
| `--brand-initials` | Derived | Short visual mark |
| `--supabase-project-id` | Unscoped name | Local Supabase project ID |
| `--dev-port` | `3000` | Local site and callback port |
| `--install` / `--no-install` | Install | Toggle dependency installation |
| `--git` / `--no-git` | Initialize | Toggle clean Git initialization |
| `--commit` | Disabled | Create the initial commit |

The script:

1. Validates the environment, metadata, port, and destination.
2. Copies through a temporary directory.
3. Excludes `.git`, `.env*`, dependencies, build and test output, editor state,
   TypeScript caches, and local Supabase state.
4. Retains `.env.example` and creates an empty `.env.local`.
5. Updates `package.json` and `scaffold.config.json` as structured JSON.
6. Replaces the known UI brand, root metadata, README headings, style guide
   references, and local Supabase settings.
7. Runs `pnpm install --frozen-lockfile` by default.
8. Creates a new `main` Git repository and adds `origin` when supplied.

It refuses to overwrite an existing directory or generate inside the source
directory.

## 6. Manual Migration

### Make a clean copy

```bash
rsync -a \
  --exclude='.git' \
  --exclude='.env*' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.next-dev' \
  --exclude='coverage' \
  --exclude='*.tsbuildinfo' \
  ./ ../my-project/

cp .env.example ../my-project/.env.example
cd ../my-project
cp .env.example .env.local
```

Never copy the current `.env`. Each product should use its own Supabase project.

### Remove inherited Git history

The safest method is not copying `.git` at all. If a full copy already exists,
run the following only after verifying that the current directory is the new
copy:

```bash
rm -rf .git
git init -b main
git add .
git commit -m "chore: initialize project"
```

This permanently removes commits, branches, tags, remotes, and reflogs from that
copy. To preserve an upstream relationship instead:

```bash
git remote rename origin upstream
git remote add origin git@github.com:your-org/your-project.git
```

GitHub and GitLab template repositories are another clean-history option.

### Update metadata and branding

Set at least `name`, `version`, `private`, `description`, `author`, `license`, and
`repository` in `package.json`. Keep `scaffold.config.json` synchronized with the
actual current display name and initials so future generations can replace them.

Review these files manually:

```text
src/app/layout.tsx
src/components/brand.tsx
src/app/page.tsx
src/app/login/page.tsx
src/app/workspace/page.tsx
src/app/terms/page.tsx
src/app/privacy/page.tsx
README.md
README.en.md
docs/style-guide.md
docs/style-guide.en.md
```

The script does not write product copy, identify the legal operator, or design
business data.

### Configure Supabase

1. Create a separate Supabase project.
2. Copy its project URL and Publishable key into `.env.local`.
3. Enable Email and Confirm email.
4. Configure local and production URLs:

```text
Site URL
http://localhost:3000

Redirect URLs
http://localhost:3000/auth/confirm
http://localhost:3000/auth/callback
https://your-domain.example/auth/confirm
https://your-domain.example/auth/callback
```

5. Apply the Confirm signup and Magic Link templates described in
   `supabase/README.en.md`.
6. Configure production SMTP.
7. Design ownership, constraints, indexes, and RLS in `supabase/schema.sql`
   before adding business tables.

`supabase/config.toml` controls local Supabase CLI services only. It does not
change a hosted project's providers, URLs, templates, or SMTP settings.

## 7. Dependency Management

Retain `pnpm-lock.yaml`; metadata-only changes do not require regenerating it.

```bash
pnpm install --frozen-lockfile
pnpm add package-name
pnpm add -D package-name
pnpm remove package-name
```

For intentional upgrades:

```bash
pnpm outdated
pnpm update --interactive
pnpm check
pnpm build
```

Do not edit `pnpm-lock.yaml` manually or commit npm/Yarn lockfiles beside it.
Prefer the existing framework and libraries before adding dependencies.

## 8. Verification

Inspect generated metadata and Git state:

```bash
node -e 'const p=require("./package.json"); console.log(p.name, p.description, p.repository)'
node -e 'console.log(require("./scaffold.config.json"))'
sed -n '1,12p' supabase/config.toml
git remote -v
git status --short
git check-ignore .env.local
```

After filling `.env.local`, run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm dev
```

Verify these workflows:

1. Public pages show the new brand.
2. Anonymous `/workspace` requests redirect to login with a safe `next` value.
3. Registration sends a confirmation message and returns to login after success.
4. Email codes are six digits and retain the 60-second resend cooldown.
5. Password login, sign-out, recovery, and reset work.
6. The private page reads the current user on the server.
7. External redirect attempts are rejected.
8. Hosted Site URL, callback URLs, templates, and SMTP match production.

## 9. Troubleshooting

**Destination already exists:** choose another `--target` or inspect and remove
the old directory manually. The script intentionally has no force-overwrite mode.

**Invalid package name:** use lowercase `billing-console` or
`@acme/billing-console`; use `--display-name` for human-facing capitalization.

**Frozen lockfile failure:** align pnpm with `packageManager`. If dependencies were
intentionally changed, run `pnpm install`, review both manifest and lockfile, then
commit them together.

**Missing Supabase configuration:** confirm `.env.local` contains exactly
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then restart
the development server. Never expose a service role key through `NEXT_PUBLIC_*`.

**Confirmation or recovery links fail:** check hosted Site URL, Redirect URLs, and
templates. Confirmation uses `TokenHash` through `/auth/confirm`; recovery
exchanges a PKCE code through `/auth/callback`.

**Email contains a link instead of a code:** hosted Supabase does not read local
templates. Change the hosted Magic Link template body to `{{ .Token }}` and send
a new email.

**Old branding remains:** verify that the source `scaffold.config.json` matches
the source UI, then search:

```bash
rg -n "old-name|old-initials" \
  src README.md README.en.md docs supabase package.json scaffold.config.json
```

**Local Supabase ports conflict:** `project_id` does not reserve ports. Change the
API, database, Studio, SMTP, and application ports as one coordinated set.

## 10. Final Checklist

- [ ] Name, display name, description, author, version, license, and repository are correct.
- [ ] Git history is empty or contains only the new initialization commit.
- [ ] `.env.local` is ignored and no old credentials or user data remain.
- [ ] Supabase project, URLs, Email provider, templates, and SMTP are configured.
- [ ] Homepage, workspace, legal pages, and README files describe the real product.
- [ ] Business tables include ownership, constraints, indexes, and RLS.
- [ ] `pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm build` pass.
- [ ] Registration, confirmation, login, code, sign-out, and recovery are tested.
