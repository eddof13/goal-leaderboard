-- Goal Leaderboard — initial schema
-- User (profiles), Goal, ProofEntry. Leaderboard is a derived view, not a table.

create type goal_category as enum (
  'fitness',
  'reading',
  'cold_exposure_approach',
  'sobriety',
  'other'
);

create type goal_type as enum ('cadence', 'target');
create type cadence_period as enum ('daily', 'weekly');
create type goal_status as enum ('active', 'completed', 'failed', 'abandoned');

-- One row per auth.users row, holds the display name shown on the leaderboard.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  category goal_category not null,
  title text not null,
  description text,
  goal_type goal_type not null,
  cadence_period cadence_period,
  cadence_count integer,
  target_count integer,
  deadline date not null,
  status goal_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint cadence_fields_required check (
    (goal_type = 'cadence' and cadence_period is not null and cadence_count is not null and target_count is null)
    or
    (goal_type = 'target' and target_count is not null and cadence_period is null and cadence_count is null)
  )
);

create table proof_entries (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  occurred_at date not null,
  submitted_at timestamptz not null default now(),
  photo_url text not null,
  note text
);

create index goals_user_id_idx on goals (user_id);
create index proof_entries_goal_id_idx on proof_entries (goal_id);
create index proof_entries_user_id_idx on proof_entries (user_id);

-- Auto-create a profile row whenever someone signs up.
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- RLS: leaderboard requires reading everyone's goals/proof/display names, but
-- writes are restricted to the owning user.
alter table profiles enable row level security;
alter table goals enable row level security;
alter table proof_entries enable row level security;

create policy "profiles are viewable by everyone"
  on profiles for select using (true);
create policy "users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "goals are viewable by everyone"
  on goals for select using (true);
create policy "users can insert own goals"
  on goals for insert with check (auth.uid() = user_id);
create policy "users can update own goals"
  on goals for update using (auth.uid() = user_id);
create policy "users can delete own goals"
  on goals for delete using (auth.uid() = user_id);

create policy "proof entries are viewable by everyone"
  on proof_entries for select using (true);
create policy "users can insert own proof entries"
  on proof_entries for insert with check (auth.uid() = user_id);
create policy "users can update own proof entries"
  on proof_entries for update using (auth.uid() = user_id);
create policy "users can delete own proof entries"
  on proof_entries for delete using (auth.uid() = user_id);

-- Storage bucket for proof photos, private by default with RLS-style policies.
insert into storage.buckets (id, name, public)
values ('proof-photos', 'proof-photos', true);

create policy "proof photos are viewable by everyone"
  on storage.objects for select using (bucket_id = 'proof-photos');
create policy "users can upload their own proof photos"
  on storage.objects for insert with check (
    bucket_id = 'proof-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
