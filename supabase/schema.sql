
create table if not exists public.profiles (
  id uuid primary key references auth.users(id),
  email text unique,
  display_name text,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "User can access own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "User can update own profile" on public.profiles
  for update using (auth.uid() = id);
