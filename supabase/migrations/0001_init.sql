-- Leftovers schema (docs/LLD.md §8.3).
-- Run in Supabase: Dashboard → SQL Editor → paste → Run. Safe to re-run.

create extension if not exists pgcrypto;

-- ---------- posts ----------
create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 1 and 80),
  description     text not null default '' check (char_length(description) <= 500),
  building_id     text not null,
  room            text check (room is null or char_length(room) <= 40),
  photo_url       text,
  est_servings    int check (est_servings is null or est_servings between 1 and 500),
  dietary_tags    text[] not null default '{}',
  allergens       text[] not null default '{}',
  source          text not null check (source in ('photo', 'poster', 'manual')),
  available_from  timestamptz not null default now(),
  expires_at      timestamptz not null,
  status          text not null default 'active' check (status in ('active', 'gone', 'removed')),
  heading_count   int not null default 0 check (heading_count >= 0),
  gone_count      int not null default 0 check (gone_count >= 0),
  ai_run_id       uuid,
  created_at      timestamptz not null default now(),
  constraint posts_window check (expires_at > available_from)
);
create index if not exists posts_expires_at_idx on public.posts (expires_at);

-- Owner identity lives apart from posts so it never leaks via the API or realtime.
create table if not exists public.post_owners (
  post_id   uuid primary key references public.posts (id) on delete cascade,
  client_id uuid not null
);
create index if not exists post_owners_client_idx on public.post_owners (client_id);

create table if not exists public.signals (
  id         bigint generated always as identity primary key,
  post_id    uuid not null references public.posts (id) on delete cascade,
  client_id  uuid not null,
  type       text not null check (type in ('heading', 'gone')),
  created_at timestamptz not null default now(),
  unique (post_id, client_id, type)
);

create table if not exists public.ai_runs (
  id             uuid primary key default gen_random_uuid(),
  mode           text not null check (mode in ('food', 'poster')),
  model          text not null,
  prompt_version text not null,
  output         jsonb not null,
  latency_ms     int not null,
  post_id        uuid references public.posts (id) on delete set null,
  edited_fields  text[],
  created_at     timestamptz not null default now()
);

-- ---------- RLS: anon can only read posts; all writes go through the server (service role) ----------
alter table public.posts       enable row level security;
alter table public.post_owners enable row level security;
alter table public.signals     enable row level security;
alter table public.ai_runs     enable row level security;

drop policy if exists "posts are public" on public.posts;
create policy "posts are public" on public.posts for select to anon, authenticated using (status <> 'removed');

-- ---------- atomic signal recording ----------
create or replace function public.record_signal(
  p_post_id uuid,
  p_client_id uuid,
  p_type text,
  p_gone_threshold int
) returns setof public.posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int;
  v_is_owner boolean;
begin
  if p_type not in ('heading', 'gone') then
    raise exception 'invalid signal type %', p_type;
  end if;

  -- lock the post row so concurrent signals serialise
  perform 1 from posts where id = p_post_id for update;
  if not found then
    return;
  end if;

  insert into signals (post_id, client_id, type)
  values (p_post_id, p_client_id, p_type)
  on conflict (post_id, client_id, type) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    if p_type = 'heading' then
      update posts set heading_count = heading_count + 1 where id = p_post_id;
    else
      update posts set gone_count = gone_count + 1 where id = p_post_id;
    end if;
  end if;

  if p_type = 'gone' then
    select exists (select 1 from post_owners where post_id = p_post_id and client_id = p_client_id)
      into v_is_owner;
    update posts
       set status = 'gone'
     where id = p_post_id
       and status = 'active'
       and (v_is_owner or gone_count >= p_gone_threshold);
  end if;

  return query select * from posts where id = p_post_id;
end;
$$;

revoke all on function public.record_signal(uuid, uuid, text, int) from public, anon, authenticated;
grant execute on function public.record_signal(uuid, uuid, text, int) to service_role;

-- ---------- realtime (client only uses it as a "something changed" ping) ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;

-- ---------- storage bucket for photos (public read; uploads only via service role) ----------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;
