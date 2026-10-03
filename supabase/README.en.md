# Supabase Configuration

[中文](./README.md)

This directory contains LinguaFlow's Auth, Postgres, Storage, and local
development configuration.

## Initialize

`platform.sql` creates the application tables, indexes, update triggers, and RLS
policies. Run the complete file in the Supabase Dashboard SQL Editor for a new
project. It is safe to run repeatedly.

For an existing project, create a backup, review, and apply `updated.sql`. It adds
the video parse cache and
its RLS policy, the local video source, transcript translation target language,
vocabulary part-of-speech and dictionary metadata columns, vocabulary-tag
relations, persistent bilingual AI analysis, registration email-domain
restrictions, `profiles` RLS policies, and historical profile backfill. The
script notifies PostgREST to reload its schema cache when it completes.

This repository does not include a `supabase/migrations/` directory, so
`supabase db push` does not apply these SQL files. Keep database deployment
separate from the Vercel build; see
[the deployment guide](../docs/vercel-deployment.md).

The schema covers videos, parse caches, progress, notes, transcript cues,
vocabulary, vocabulary-tag relations, Ebbinghaus review logs, playlists, and
study sessions.
Account-level learning preferences live in
`profiles.preferences`. Transcript and vocabulary writes are protected by user
ownership policies that also validate linked video ownership.
Account-level default video tags live in `profiles.preferences`. Library caption
filters use a read-only summary of `transcript_cues`.
Local video handles stay in browser IndexedDB; Supabase stores only the local
resource key and learning metadata. Transcript translations record their target
in `translation_language`. Vocabulary rows store UK/US phonetics, parts of speech,
separate English and translated definitions, examples, etymology metadata, and
optional bilingual AI analysis. `vocabulary_tags` reuses account tags and applies
RLS checks to both the tag and vocabulary word owner. The AI enabled state,
provider, endpoint type, endpoint URL, model name, and API key all remain in the current browser's
localStorage and are never written to Supabase. Persisted analysis results contain
no model configuration metadata. `updated.sql` removes historical configuration
fields from preferences and analysis results, then adds allowlist constraints.
The learning calendar aggregates `study_sessions`, `review_logs`, and `notes`.

`video_parse_cache` uniquely stores public metadata and valid captions by
`(user_id, source_key)`. Inspection does not create a `videos` row or upload
remote media. On import, `videos.source_key` updates the existing source match
instead of creating a duplicate.

## Authentication

In the Supabase Dashboard:

1. Enable the Email provider, sign-ups, and Confirm email.
2. Configure the Site URL.
3. Allow the full local and production `/auth/callback` and `/auth/confirm` URLs.
4. Apply the confirmation and OTP templates from `templates/`.

`platform.sql` and `updated.sql` validate the email domain before inserting into
`auth.users`, so direct calls to the public Auth API cannot bypass the restriction.
Existing accounts are unaffected.

Local configuration uses `http://localhost:5566` by default. Test emails are
available at `http://127.0.0.1:54324`.

## Security

- Browser and SSR session clients only use the publishable key.
- Every business table has RLS ownership policies based on `auth.uid()`.
- New local videos are not written to Storage; legacy Storage rows remain readable
  under their existing RLS policies.
- Every Server Action reloads the authenticated user and ignores client-provided
  ownership values.
- No service role key is required.
