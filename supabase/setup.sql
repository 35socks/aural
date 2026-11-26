-- Accounts for the Aural Skills trainer.
-- Run once: Supabase dashboard > SQL Editor > New query > paste this > Run. Safe to run again.

create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint progress_size check (pg_column_size(data) < 1048576)
);

-- Row level security: a signed-in person can only see and change their own row. Nobody else can read it.
alter table public.progress enable row level security;

revoke all on public.progress from anon, authenticated;
grant select, insert, update on public.progress to authenticated;

drop policy if exists "read own progress" on public.progress;
create policy "read own progress" on public.progress
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "add own progress" on public.progress;
create policy "add own progress" on public.progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "change own progress" on public.progress;
create policy "change own progress" on public.progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Make the new table visible to the website straight away.
notify pgrst, 'reload schema';
