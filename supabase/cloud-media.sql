-- Cloud media metadata table for «Путь» (staged; not applied to any Supabase project).
create table if not exists public.cloud_media (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  outing_id text,
  object_key text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cloud_media enable row level security;
create policy "Users can read their media metadata"
  on public.cloud_media for select using (auth.uid() = user_id);
create policy "Users can insert their media metadata"
  on public.cloud_media for insert with check (auth.uid() = user_id);
create policy "Users can update their media metadata"
  on public.cloud_media for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their media metadata"
  on public.cloud_media for delete using (auth.uid() = user_id);
