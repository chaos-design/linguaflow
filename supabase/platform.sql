-- 平台完整数据库脚本（唯一权威全量 SQL）
--
-- 使用方式：
-- 1. 在 Supabase SQL Editor 中打开本文件。
-- 2. 整体执行，用于初始化新环境或核对完整数据库结构。
--
-- 覆盖范围：
-- - 业务表、约束、索引和更新时间触发器
-- - Auth 用户 Profile 自动创建与历史用户回填
-- - RLS 所有权隔离与关联资源归属校验
-- - 视频 Storage 桶及访问策略

create extension if not exists pg_trgm with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text,
  preferences jsonb not null default '{}'::jsonb
    constraint profiles_preferences_learning_only_check
    check (
      coalesce(jsonb_typeof(preferences) = 'object', false)
      and preferences - array[
        'version',
        'autoOpen',
        'bilingualCaptions',
        'captionSize',
        'subtitleTranslationLanguage',
        'calendarColor',
        'highlightMastered',
        'reviewTarget',
        'dailyNewLimit',
        'autoPause',
        'dictionary',
        'translation',
        'phonetic',
        'autoPronounce',
        'sync',
        'weeklySummary',
        'resumePlayback',
        'defaultVideoTags'
      ]::text[] = '{}'::jsonb
    ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

update public.profiles
set preferences = (
  select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
  from jsonb_each(
    case
      when jsonb_typeof(profiles.preferences) = 'object' then profiles.preferences
      else '{}'::jsonb
    end
  ) as entry
  where entry.key = any (
    array[
      'version',
      'autoOpen',
      'bilingualCaptions',
      'captionSize',
      'subtitleTranslationLanguage',
      'calendarColor',
      'highlightMastered',
      'reviewTarget',
      'dailyNewLimit',
      'autoPause',
      'dictionary',
      'translation',
      'phonetic',
      'autoPronounce',
      'sync',
      'weeklySummary',
      'resumePlayback',
      'defaultVideoTags'
    ]::text[]
  )
)
where jsonb_typeof(preferences) is distinct from 'object'
  or preferences - array[
    'version',
    'autoOpen',
    'bilingualCaptions',
    'captionSize',
    'subtitleTranslationLanguage',
    'calendarColor',
    'highlightMastered',
    'reviewTarget',
    'dailyNewLimit',
    'autoPause',
    'dictionary',
    'translation',
    'phonetic',
    'autoPronounce',
    'sync',
    'weeklySummary',
    'resumePlayback',
    'defaultVideoTags'
  ]::text[] <> '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_preferences_learning_only_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_preferences_learning_only_check
      check (
        coalesce(jsonb_typeof(preferences) = 'object', false)
        and preferences - array[
          'version',
          'autoOpen',
          'bilingualCaptions',
          'captionSize',
          'subtitleTranslationLanguage',
          'calendarColor',
          'highlightMastered',
          'reviewTarget',
          'dailyNewLimit',
          'autoPause',
          'dictionary',
          'translation',
          'phonetic',
          'autoPronounce',
          'sync',
          'weeklySummary',
          'resumePlayback',
          'defaultVideoTags'
        ]::text[] = '{}'::jsonb
      );
  end if;
end;
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default 'neutral' check (
    color in ('neutral', 'blue', 'green', 'amber', 'red')
  ),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists categories_user_name_unique
  on public.categories (user_id, lower(name));

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists tags_user_name_unique
  on public.tags (user_id, lower(name));

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 5000),
  source_type text not null
    constraint videos_source_type_check
    check (source_type in ('local', 'upload', 'link')),
  source_url text,
  source_key text check (char_length(source_key) <= 500),
  storage_path text,
  thumbnail_url text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  status text not null default 'ready' check (
    status in ('processing', 'ready', 'failed')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint videos_source_check check (
    (source_type = 'upload' and storage_path is not null)
    or (source_type = 'link' and source_url is not null)
    or (
      source_type = 'local'
      and source_key is not null
      and source_url is null
      and storage_path is null
    )
  )
);

alter table public.videos
  add column if not exists source_key text;

alter table public.videos
  drop constraint if exists videos_source_type_check;
alter table public.videos
  add constraint videos_source_type_check
  check (source_type in ('local', 'upload', 'link'));
alter table public.videos
  drop constraint if exists videos_source_check;
alter table public.videos
  add constraint videos_source_check check (
    (source_type = 'upload' and storage_path is not null)
    or (source_type = 'link' and source_url is not null)
    or (
      source_type = 'local'
      and source_key is not null
      and source_url is null
      and storage_path is null
    )
  );

create index if not exists videos_user_created_idx
  on public.videos (user_id, created_at desc);
create index if not exists videos_user_category_idx
  on public.videos (user_id, category_id);
create index if not exists videos_title_search_idx
  on public.videos using gin (lower(title) extensions.gin_trgm_ops);
create unique index if not exists videos_user_source_key_unique
  on public.videos (user_id, source_key)
  where source_type = 'link' and source_key is not null;
create unique index if not exists videos_user_local_source_key_unique
  on public.videos (user_id, source_key)
  where source_type = 'local' and source_key is not null;

create table if not exists public.video_parse_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null check (char_length(source_key) between 1 and 500),
  source_url text not null check (char_length(source_url) between 1 and 2000),
  provider text not null check (
    provider in ('YouTube', 'Bilibili', 'Vimeo', '直链视频', '网页视频')
  ),
  title text not null check (char_length(title) between 1 and 200),
  thumbnail_url text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  transcript_content text check (char_length(transcript_content) <= 2000000),
  transcript_cue_count integer not null default 0 check (
    transcript_cue_count between 0 and 10000
  ),
  transcript_language text check (char_length(transcript_language) <= 100),
  transcript_generated boolean not null default false,
  parsed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, source_key)
);

create index if not exists video_parse_cache_user_parsed_idx
  on public.video_parse_cache (user_id, parsed_at desc);

create table if not exists public.video_tags (
  video_id uuid not null references public.videos(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (video_id, tag_id)
);

create index if not exists video_tags_user_tag_idx
  on public.video_tags (user_id, tag_id);

create table if not exists public.video_progress (
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position_seconds integer not null default 0 check (position_seconds >= 0),
  completion_percent numeric(5, 2) not null default 0 check (
    completion_percent between 0 and 100
  ),
  completed boolean not null default false,
  last_watched_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (video_id, user_id)
);

create index if not exists video_progress_user_recent_idx
  on public.video_progress (user_id, last_watched_at desc);
create index if not exists video_progress_user_completed_idx
  on public.video_progress (user_id, completed);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  timestamp_seconds integer not null default 0 check (timestamp_seconds >= 0),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists notes_video_timestamp_idx
  on public.notes (user_id, video_id, timestamp_seconds);

create table if not exists public.transcript_cues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  start_seconds numeric(12, 3) not null check (start_seconds >= 0),
  end_seconds numeric(12, 3) not null check (end_seconds >= start_seconds),
  text text not null check (char_length(text) between 1 and 4000),
  translation text check (char_length(translation) <= 4000),
  translation_language text constraint transcript_cues_translation_language_length_check
    check (char_length(translation_language) <= 20),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.transcript_cues
  add column if not exists translation_language text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transcript_cues_translation_language_length_check'
      and conrelid = 'public.transcript_cues'::regclass
  ) then
    alter table public.transcript_cues
      add constraint transcript_cues_translation_language_length_check
      check (char_length(translation_language) <= 20);
  end if;
end;
$$;

create index if not exists transcript_cues_video_time_idx
  on public.transcript_cues (user_id, video_id, start_seconds);

create table if not exists public.vocabulary_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  word text not null check (char_length(word) between 1 and 120),
  phonetic text check (char_length(phonetic) <= 200),
  phonetic_uk text constraint vocabulary_words_phonetic_uk_length_check
    check (char_length(phonetic_uk) <= 200),
  phonetic_us text constraint vocabulary_words_phonetic_us_length_check
    check (char_length(phonetic_us) <= 200),
  part_of_speech text constraint vocabulary_words_part_of_speech_length_check
    check (char_length(part_of_speech) <= 80),
  definition text not null check (char_length(definition) between 1 and 4000),
  definition_translation text
    constraint vocabulary_words_definition_translation_length_check
    check (char_length(definition_translation) <= 4000),
  examples jsonb not null default '[]'::jsonb
    constraint vocabulary_words_examples_array_check
    check (jsonb_typeof(examples) = 'array'),
  example_translations jsonb not null default '[]'::jsonb
    constraint vocabulary_words_example_translations_array_check
    check (jsonb_typeof(example_translations) = 'array'),
  common_phrases jsonb not null default '[]'::jsonb
    constraint vocabulary_words_common_phrases_array_check
    check (jsonb_typeof(common_phrases) = 'array'),
  word_analysis jsonb not null default '{}'::jsonb
    constraint vocabulary_words_word_analysis_object_check
    check (jsonb_typeof(word_analysis) = 'object'),
  dictionary_sources jsonb not null default '[]'::jsonb
    constraint vocabulary_words_dictionary_sources_array_check
    check (jsonb_typeof(dictionary_sources) = 'array'),
  ai_analysis jsonb not null default '{}'::jsonb
    constraint vocabulary_words_ai_analysis_object_check
    check (coalesce(jsonb_typeof(ai_analysis) = 'object', false)),
  source_title text not null check (char_length(source_title) between 1 and 200),
  source_timestamp_seconds integer not null default 0 check (
    source_timestamp_seconds >= 0
  ),
  source_sentence text check (char_length(source_sentence) <= 4000),
  translation text check (char_length(translation) <= 4000),
  mastery text not null default 'new' check (
    mastery in ('new', 'learning', 'mastered')
  ),
  ease_factor numeric(4, 2) not null default 2.50 check (
    ease_factor between 1.30 and 3.50
  ),
  interval_days integer not null default 0 check (
    interval_days between 0 and 36500
  ),
  repetitions integer not null default 0 check (
    repetitions between 0 and 100000
  ),
  due_at timestamptz not null default timezone('utc', now()),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.vocabulary_words
  add column if not exists phonetic_uk text;
alter table public.vocabulary_words
  add column if not exists phonetic_us text;
alter table public.vocabulary_words
  add column if not exists part_of_speech text;
alter table public.vocabulary_words
  add column if not exists definition_translation text;
alter table public.vocabulary_words
  add column if not exists examples jsonb not null default '[]'::jsonb;
alter table public.vocabulary_words
  add column if not exists example_translations jsonb not null default '[]'::jsonb;
alter table public.vocabulary_words
  add column if not exists common_phrases jsonb not null default '[]'::jsonb;
alter table public.vocabulary_words
  add column if not exists word_analysis jsonb not null default '{}'::jsonb;
alter table public.vocabulary_words
  add column if not exists dictionary_sources jsonb not null default '[]'::jsonb;
alter table public.vocabulary_words
  add column if not exists ai_analysis jsonb not null default '{}'::jsonb;

alter table public.vocabulary_words
  alter column examples set default '[]'::jsonb;
alter table public.vocabulary_words
  alter column example_translations set default '[]'::jsonb;
alter table public.vocabulary_words
  alter column common_phrases set default '[]'::jsonb;
alter table public.vocabulary_words
  alter column word_analysis set default '{}'::jsonb;
alter table public.vocabulary_words
  alter column dictionary_sources set default '[]'::jsonb;
alter table public.vocabulary_words
  alter column ai_analysis set default '{}'::jsonb;

update public.vocabulary_words
set examples = '[]'::jsonb
where examples is null;
update public.vocabulary_words
set example_translations = '[]'::jsonb
where example_translations is null;
update public.vocabulary_words
set common_phrases = '[]'::jsonb
where common_phrases is null;
update public.vocabulary_words
set word_analysis = '{}'::jsonb
where word_analysis is null;
update public.vocabulary_words
set dictionary_sources = '[]'::jsonb
where dictionary_sources is null;
update public.vocabulary_words
set ai_analysis = '{}'::jsonb
where ai_analysis is null;

update public.vocabulary_words
set ai_analysis = (
  select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
  from jsonb_each(
    case
      when jsonb_typeof(vocabulary_words.ai_analysis) = 'object'
        then vocabulary_words.ai_analysis
      else '{}'::jsonb
    end
  ) as entry
  where entry.key = any (
    array[
      'generatedAt',
      'cefrLevel',
      'examLabels',
      'meanings',
      'inflections',
      'explanation',
      'partsOfSpeech',
      'tenses',
      'etymology',
      'etymologyTree',
      'wordParts',
      'wordPartMemory',
      'derivatives',
      'examples',
      'collocations',
      'phrases',
      'idioms',
      'synonyms',
      'antonyms',
      'replacements',
      'newMeanings'
    ]::text[]
  )
)
where jsonb_typeof(ai_analysis) is distinct from 'object'
  or ai_analysis - array[
    'generatedAt',
    'cefrLevel',
    'examLabels',
    'meanings',
    'inflections',
    'explanation',
    'partsOfSpeech',
    'tenses',
    'etymology',
    'etymologyTree',
    'wordParts',
    'wordPartMemory',
    'derivatives',
    'examples',
    'collocations',
    'phrases',
    'idioms',
    'synonyms',
    'antonyms',
    'replacements',
    'newMeanings'
  ]::text[] <> '{}'::jsonb;

alter table public.vocabulary_words
  alter column examples set not null;
alter table public.vocabulary_words
  alter column example_translations set not null;
alter table public.vocabulary_words
  alter column common_phrases set not null;
alter table public.vocabulary_words
  alter column word_analysis set not null;
alter table public.vocabulary_words
  alter column dictionary_sources set not null;
alter table public.vocabulary_words
  alter column ai_analysis set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_words_part_of_speech_length_check'
      and conrelid = 'public.vocabulary_words'::regclass
  ) then
    alter table public.vocabulary_words
      add constraint vocabulary_words_part_of_speech_length_check
      check (char_length(part_of_speech) <= 80);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_words_phonetic_uk_length_check'
      and conrelid = 'public.vocabulary_words'::regclass
  ) then
    alter table public.vocabulary_words
      add constraint vocabulary_words_phonetic_uk_length_check
      check (char_length(phonetic_uk) <= 200);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_words_phonetic_us_length_check'
      and conrelid = 'public.vocabulary_words'::regclass
  ) then
    alter table public.vocabulary_words
      add constraint vocabulary_words_phonetic_us_length_check
      check (char_length(phonetic_us) <= 200);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_words_definition_translation_length_check'
      and conrelid = 'public.vocabulary_words'::regclass
  ) then
    alter table public.vocabulary_words
      add constraint vocabulary_words_definition_translation_length_check
      check (char_length(definition_translation) <= 4000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_words_examples_array_check'
      and conrelid = 'public.vocabulary_words'::regclass
  ) then
    alter table public.vocabulary_words
      add constraint vocabulary_words_examples_array_check
      check (jsonb_typeof(examples) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_words_example_translations_array_check'
      and conrelid = 'public.vocabulary_words'::regclass
  ) then
    alter table public.vocabulary_words
      add constraint vocabulary_words_example_translations_array_check
      check (jsonb_typeof(example_translations) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_words_common_phrases_array_check'
      and conrelid = 'public.vocabulary_words'::regclass
  ) then
    alter table public.vocabulary_words
      add constraint vocabulary_words_common_phrases_array_check
      check (jsonb_typeof(common_phrases) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_words_word_analysis_object_check'
      and conrelid = 'public.vocabulary_words'::regclass
  ) then
    alter table public.vocabulary_words
      add constraint vocabulary_words_word_analysis_object_check
      check (jsonb_typeof(word_analysis) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_words_dictionary_sources_array_check'
      and conrelid = 'public.vocabulary_words'::regclass
  ) then
    alter table public.vocabulary_words
      add constraint vocabulary_words_dictionary_sources_array_check
      check (jsonb_typeof(dictionary_sources) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_words_ai_analysis_object_check'
      and conrelid = 'public.vocabulary_words'::regclass
  ) then
    alter table public.vocabulary_words
      add constraint vocabulary_words_ai_analysis_object_check
      check (coalesce(jsonb_typeof(ai_analysis) = 'object', false));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vocabulary_words_ai_analysis_content_only_check'
      and conrelid = 'public.vocabulary_words'::regclass
  ) then
    alter table public.vocabulary_words
      add constraint vocabulary_words_ai_analysis_content_only_check
      check (
        ai_analysis - array[
          'generatedAt',
          'cefrLevel',
          'examLabels',
          'meanings',
          'inflections',
          'explanation',
          'partsOfSpeech',
          'tenses',
          'etymology',
          'etymologyTree',
          'wordParts',
          'wordPartMemory',
          'derivatives',
          'examples',
          'collocations',
          'phrases',
          'idioms',
          'synonyms',
          'antonyms',
          'replacements',
          'newMeanings'
        ]::text[] = '{}'::jsonb
      );
  end if;
end;
$$;

create index if not exists vocabulary_words_user_due_idx
  on public.vocabulary_words (user_id, due_at, created_at);
create index if not exists vocabulary_words_user_created_idx
  on public.vocabulary_words (user_id, created_at desc);
create unique index if not exists vocabulary_words_user_video_word_unique
  on public.vocabulary_words (
    user_id,
    coalesce(video_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(word)
  );

create table if not exists public.vocabulary_tags (
  vocabulary_id uuid not null references public.vocabulary_words(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (vocabulary_id, tag_id)
);

create index if not exists vocabulary_tags_user_tag_idx
  on public.vocabulary_tags (user_id, tag_id);

create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary_words(id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  previous_interval_days integer not null check (previous_interval_days >= 0),
  next_interval_days integer not null check (next_interval_days >= 0),
  reviewed_at timestamptz not null default timezone('utc', now())
);

create index if not exists review_logs_user_date_idx
  on public.review_logs (user_id, reviewed_at desc);
create index if not exists review_logs_vocabulary_idx
  on public.review_logs (user_id, vocabulary_id, reviewed_at desc);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text check (char_length(description) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists playlists_user_updated_idx
  on public.playlists (user_id, updated_at desc);

create table if not exists public.playlist_items (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  added_at timestamptz not null default timezone('utc', now()),
  primary key (playlist_id, video_id)
);

create index if not exists playlist_items_order_idx
  on public.playlist_items (user_id, playlist_id, position, added_at);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists study_sessions_user_date_idx
  on public.study_sessions (user_id, started_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at
before update on public.videos
for each row execute function public.set_updated_at();

drop trigger if exists video_parse_cache_set_updated_at on public.video_parse_cache;
create trigger video_parse_cache_set_updated_at
before update on public.video_parse_cache
for each row execute function public.set_updated_at();

drop trigger if exists progress_set_updated_at on public.video_progress;
create trigger progress_set_updated_at
before update on public.video_progress
for each row execute function public.set_updated_at();

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

drop trigger if exists vocabulary_words_set_updated_at on public.vocabulary_words;
create trigger vocabulary_words_set_updated_at
before update on public.vocabulary_words
for each row execute function public.set_updated_at();

drop trigger if exists playlists_set_updated_at on public.playlists;
create trigger playlists_set_updated_at
before update on public.playlists
for each row execute function public.set_updated_at();

create or replace function public.validate_registration_email_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_domain text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  if not (
    email_domain = any (
      array[
        '126.com',
        '139.com',
        '163.com',
        '189.cn',
        'aliyun.com',
        'foxmail.com',
        'gmail.com',
        'hotmail.com',
        'icloud.com',
        'live.cn',
        'live.com',
        'me.com',
        'msn.com',
        'outlook.com',
        'proton.me',
        'protonmail.com',
        'qq.com',
        'sina.cn',
        'sina.com',
        'sohu.com',
        'wo.cn',
        'yahoo.com',
        'yahoo.com.cn',
        'yeah.net'
      ]::text[]
    )
  ) then
    raise exception 'Registration email domain is not supported.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_registration_email_domain()
from public, anon, authenticated;

drop trigger if exists validate_registration_email_domain on auth.users;
create trigger validate_registration_email_domain
before insert on auth.users
for each row execute function public.validate_registration_email_domain();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select
  users.id,
  nullif(users.raw_user_meta_data ->> 'display_name', '')
from auth.users as users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.videos enable row level security;
alter table public.video_parse_cache enable row level security;
alter table public.video_tags enable row level security;
alter table public.video_progress enable row level security;
alter table public.notes enable row level security;
alter table public.transcript_cues enable row level security;
alter table public.vocabulary_words enable row level security;
alter table public.vocabulary_tags enable row level security;
alter table public.review_logs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.study_sessions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check ((select auth.uid()) = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "categories_own_all" on public.categories;
create policy "categories_own_all" on public.categories
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "tags_own_all" on public.tags;
create policy "tags_own_all" on public.tags
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "videos_own_all" on public.videos;
create policy "videos_own_all" on public.videos
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "video_parse_cache_own_all" on public.video_parse_cache;
create policy "video_parse_cache_own_all" on public.video_parse_cache
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "video_tags_own_all" on public.video_tags;
create policy "video_tags_own_all" on public.video_tags
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.videos
    where videos.id = video_tags.video_id
      and videos.user_id = (select auth.uid())
  )
);

drop policy if exists "progress_own_all" on public.video_progress;
create policy "progress_own_all" on public.video_progress
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.videos
    where videos.id = video_progress.video_id
      and videos.user_id = (select auth.uid())
  )
);

drop policy if exists "notes_own_all" on public.notes;
create policy "notes_own_all" on public.notes
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.videos
    where videos.id = notes.video_id
      and videos.user_id = (select auth.uid())
  )
);

drop policy if exists "transcript_cues_own_all" on public.transcript_cues;
create policy "transcript_cues_own_all" on public.transcript_cues
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.videos
    where videos.id = transcript_cues.video_id
      and videos.user_id = (select auth.uid())
  )
);

drop policy if exists "vocabulary_words_own_all" on public.vocabulary_words;
create policy "vocabulary_words_own_all" on public.vocabulary_words
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    video_id is null
    or exists (
      select 1 from public.videos
      where videos.id = vocabulary_words.video_id
        and videos.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "vocabulary_tags_own_all" on public.vocabulary_tags;
create policy "vocabulary_tags_own_all" on public.vocabulary_tags
for all to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.vocabulary_words
    where vocabulary_words.id = vocabulary_tags.vocabulary_id
      and vocabulary_words.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.tags
    where tags.id = vocabulary_tags.tag_id
      and tags.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.vocabulary_words
    where vocabulary_words.id = vocabulary_tags.vocabulary_id
      and vocabulary_words.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.tags
    where tags.id = vocabulary_tags.tag_id
      and tags.user_id = (select auth.uid())
  )
);

drop policy if exists "review_logs_own_all" on public.review_logs;
create policy "review_logs_own_all" on public.review_logs
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.vocabulary_words
    where vocabulary_words.id = review_logs.vocabulary_id
      and vocabulary_words.user_id = (select auth.uid())
  )
);

drop policy if exists "playlists_own_all" on public.playlists;
create policy "playlists_own_all" on public.playlists
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "playlist_items_own_all" on public.playlist_items;
create policy "playlist_items_own_all" on public.playlist_items
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.playlists
    where playlists.id = playlist_items.playlist_id
      and playlists.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.videos
    where videos.id = playlist_items.video_id
      and videos.user_id = (select auth.uid())
  )
);

drop policy if exists "study_sessions_own_all" on public.study_sessions;
create policy "study_sessions_own_all" on public.study_sessions
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.videos
    where videos.id = study_sessions.video_id
      and videos.user_id = (select auth.uid())
  )
);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'videos',
  'videos',
  false,
  524288000,
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "video_storage_select_own" on storage.objects;
create policy "video_storage_select_own" on storage.objects
for select to authenticated
using (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "video_storage_insert_own" on storage.objects;
create policy "video_storage_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "video_storage_update_own" on storage.objects;
create policy "video_storage_update_own" on storage.objects
for update to authenticated
using (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "video_storage_delete_own" on storage.objects;
create policy "video_storage_delete_own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'videos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

notify pgrst, 'reload schema';
