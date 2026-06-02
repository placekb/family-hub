create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  date date not null,
  time text,
  who text not null default 'Family',
  notes text not null default '',
  repeat jsonb not null default '{"type":"none"}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  name text not null,
  notes text not null default '',
  ingredients text not null default '',
  created_at timestamptz not null default now(),
  unique (owner_id, date)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_date date,
  notes text not null default '',
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.meals to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.list_items to authenticated;

alter table public.events enable row level security;
alter table public.meals enable row level security;
alter table public.tasks enable row level security;
alter table public.list_items enable row level security;

drop policy if exists "events owner access" on public.events;
create policy "events owner access"
on public.events
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "meals owner access" on public.meals;
create policy "meals owner access"
on public.meals
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "tasks owner access" on public.tasks;
create policy "tasks owner access"
on public.tasks
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "list owner access" on public.list_items;
create policy "list owner access"
on public.list_items
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'events'
    ) then
      alter publication supabase_realtime add table public.events;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'meals'
    ) then
      alter publication supabase_realtime add table public.meals;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'tasks'
    ) then
      alter publication supabase_realtime add table public.tasks;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'list_items'
    ) then
      alter publication supabase_realtime add table public.list_items;
    end if;
  end if;
end
$$;
