-- 平台增量更新数据库脚本（现有项目升级 SQL）
--
-- 使用方式：
-- 1. 在 Supabase SQL Editor 中打开本文件。
-- 2. 整体执行，将旧版数据库结构升级到当前平台版本。
--
-- 覆盖范围：
-- - Profiles 学习偏好清理、RLS、注册触发器与历史用户回填
-- - 本地视频来源约束与视频解析缓存
-- - 字幕译文语言字段
-- - 生词词典元数据、标签归类、AI 双语分析字段与模型配置元数据清理
-- - RLS 所有权隔离与 PostgREST Schema 缓存刷新

begin;

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

alter table public.profiles enable row level security;

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

drop trigger if exists video_parse_cache_set_updated_at on public.video_parse_cache;
create trigger video_parse_cache_set_updated_at
before update on public.video_parse_cache
for each row execute function public.set_updated_at();

alter table public.video_parse_cache enable row level security;

drop policy if exists "video_parse_cache_own_all" on public.video_parse_cache;
create policy "video_parse_cache_own_all" on public.video_parse_cache
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.video_parse_cache to authenticated;

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

alter table public.vocabulary_words
  add column if not exists phonetic_uk text,
  add column if not exists phonetic_us text,
  add column if not exists part_of_speech text,
  add column if not exists definition_translation text,
  add column if not exists examples jsonb,
  add column if not exists example_translations jsonb,
  add column if not exists common_phrases jsonb,
  add column if not exists word_analysis jsonb,
  add column if not exists dictionary_sources jsonb,
  add column if not exists ai_analysis jsonb;

alter table public.vocabulary_words
  alter column examples set default '[]'::jsonb,
  alter column example_translations set default '[]'::jsonb,
  alter column common_phrases set default '[]'::jsonb,
  alter column word_analysis set default '{}'::jsonb,
  alter column dictionary_sources set default '[]'::jsonb,
  alter column ai_analysis set default '{}'::jsonb;

update public.vocabulary_words
set
  examples = coalesce(examples, '[]'::jsonb),
  example_translations = coalesce(example_translations, '[]'::jsonb),
  common_phrases = coalesce(common_phrases, '[]'::jsonb),
  word_analysis = coalesce(word_analysis, '{}'::jsonb),
  dictionary_sources = coalesce(dictionary_sources, '[]'::jsonb),
  ai_analysis = coalesce(ai_analysis, '{}'::jsonb)
where
  examples is null
  or example_translations is null
  or common_phrases is null
  or word_analysis is null
  or dictionary_sources is null
  or ai_analysis is null;

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
  alter column examples set not null,
  alter column example_translations set not null,
  alter column common_phrases set not null,
  alter column word_analysis set not null,
  alter column dictionary_sources set not null,
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

alter table public.vocabulary_words
  alter column video_id drop not null;

drop index if exists public.vocabulary_words_user_video_word_unique;
create unique index vocabulary_words_user_video_word_unique
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

alter table public.vocabulary_tags enable row level security;

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

grant select, insert, update, delete on table public.vocabulary_tags to authenticated;

notify pgrst, 'reload schema';

commit;
