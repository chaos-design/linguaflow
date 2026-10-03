# LinguaFlow Video Learning Assistant

[中文](./README.md)

LinguaFlow is a personal video learning workspace built with Next.js App Router,
shadcn/ui, and Supabase. It keeps video resources, playback progress, timestamped
notes, playlists, and learning statistics in one account.

## Features

- Email authentication with registration, verification, password and OTP login,
  password recovery, and password reset.
- Persistent local-file access and link imports with categories, default tags,
  and combined source, caption, and progress filters. Local video bytes are never uploaded.
- Public metadata and available caption inspection for YouTube, Bilibili, Vimeo,
  and direct media URLs without uploading or creating a video record during inspection.
- Per-user parse caching for valid captions, cache-first reuse, confirmed refreshes,
  and source-key deduplication that updates existing library videos.
- Automatic playback progress and resume support.
- Timestamped notes with create, edit, delete, and seek actions.
- Automatic public-platform caption parsing with optional SRT/WebVTT overrides,
  transcript search, seeking, and viewport-triggered translations persisted in Supabase.
- English dictionary lookup for words and short phrases, with UK/US phonetics,
  multiple examples, daily limits, and persisted Ebbinghaus review schedules.
- Optional built-in B1, B2/IELTS 6, C1, and common-phrase packs with
  deduplication, automatic tags, and staggered first-review dates.
- Manual vocabulary entry, CSV/TSV batch import and management, import-time and
  bulk tag assignment, tag filtering, CSV backups, and Anki-compatible TSV exports.
- Custom playlists with item removal and batch playlist management.
- Learning time, completion, notes, streak, seven-day activity, and a 20-week calendar.
- Responsive desktop/mobile UI with light, dark, and system themes.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4, shadcn/ui, Lucide
- Supabase Auth, Postgres, Storage, and Row Level Security
- Biome, Vitest, and pnpm

## Requirements

- Node.js 20+
- pnpm 11
- A Supabase project
- Current Chrome or Edge for persistent local video file access
- Optional: Docker Desktop for local Supabase

## Run Locally

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:5566](http://localhost:5566).

Development and production both read data created by real imports, parsing, and
learning activity in Supabase. There is no demo dataset fallback.

## Environment Variables

Only two public variables are required. Add the server-side hostname allowlist
when using a custom AI endpoint:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
AI_ALLOWED_HOSTS=gateway.example.com
```

Get the first two values from `Project Settings > API` in Supabase. Never commit
`.env.local`, access tokens, database passwords, or a service role key.
`AI_ALLOWED_HOSTS` accepts comma-separated exact hostnames. The official OpenAI,
Anthropic, and Agnes AI hostnames are built in.

## Configure Supabase

For a hosted project:

`supabase/platform.sql` creates the application tables, indexes, triggers, and
RLS policies. Run it in the Supabase SQL Editor for a new project. Back up an
existing project, then review and run `supabase/updated.sql`.
The database registration trigger rejects email domains outside the common-provider
allowlist, so direct Auth API calls cannot bypass the form validation.

This repository does not contain versioned migrations that `supabase db push`
can deploy. Keep database changes separate from the Vercel build.

The data model includes parse caches, transcript cues, vocabulary words,
vocabulary-tag relations, and review logs in addition to videos, progress, notes,
playlists, and study sessions.
Public video metadata and English definitions use platform APIs and the Free
Dictionary API, so no extra credentials are required. Optional deep vocabulary
analysis uses an OpenAI-compatible model configured in Settings.

Local video handles stay in the current browser's IndexedDB. Supabase stores only
metadata, captions, notes, and learning progress. Account-level default video tags
live in `profiles.preferences`. Library caption filters use a read-only summary of
`transcript_cues`.
`transcript_cues.translation_language` identifies persisted on-demand translations.
Vocabulary rows store UK/US phonetics, parts of speech, separate
English/translated definitions, examples, etymology metadata, and optional
bilingual AI analysis. `vocabulary_tags` associates reusable user tags with
vocabulary words for classification and filtering.
The AI enabled state, provider, endpoint type, endpoint URL, model name, and API
key all remain in the current browser's localStorage and are never written to
Supabase. Persisted AI analysis results contain no model configuration metadata.

Public inspection results are uniquely cached by `(user_id, source_key)` in
`video_parse_cache`. Inspection never uploads remote media or creates a `videos`
row. Confirmed imports update an existing source-key match instead of creating a
duplicate.

Audio transcription is intentionally not simulated. Videos without captions
need an SRT or WebVTT file unless a real transcription service is added later.

In `Authentication > URL Configuration`, set the local and production Site URL
and allow the full `/auth/callback` and `/auth/confirm` URLs. Enable the Email
provider and Confirm email. Reference templates live in `supabase/templates/`;
hosted templates must be configured in the Dashboard.

For local Supabase:

```bash
pnpm supabase:start
pnpm supabase:status
pnpm dev
```

Copy the local API URL and publishable/anon key into `.env.local`. Local emails
are available in Inbucket at `http://127.0.0.1:54324` by default.

## Quality Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm check
pnpm build
```

## Deployment

For Vercel, import the repository, configure the two public Supabase variables
for Preview and Production, apply the Supabase SQL separately, and configure
the production and preview auth callback URLs. `vercel.json` installs with a
frozen lockfile and runs environment validation and the production build through
`pnpm vercel:build`. Biome, TypeScript, and Vitest run as quality gates in CI on
pull requests and pushes to `main`, not in the deployment build.

See the Chinese [Vercel deployment guide](./docs/vercel-deployment.md) and
[user guide](./docs/user-guide.md) for the complete operational workflow.

Review and replace the legal templates, operating entity details, and production
email configuration before launch.
