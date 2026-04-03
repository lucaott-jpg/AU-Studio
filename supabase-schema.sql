-- ================================================
-- AURUM STUDIO — Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ------------------------------------------------
-- PROFILES (extends Supabase auth.users)
-- ------------------------------------------------
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------
-- PROJECTS
-- ------------------------------------------------
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  type text not null check (type in ('pdf', 'ppt', 'image', 'logo')),
  status text not null default 'draft' check (status in ('draft', 'in_progress', 'in_review', 'published')),
  workspace text not null default 'personal' check (workspace in ('team', 'personal', 'publication')),
  briefing text,
  file_url text,
  thumbnail_url text,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------
-- LOGO ASSETS
-- ------------------------------------------------
create table public.logo_assets (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade,
  original_url text not null,
  transparent_url text,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------

-- Profiles: users can read all, update own
alter table public.profiles enable row level security;
create policy "Profiles are viewable by authenticated users" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Projects: team workspace visible to all, personal only to owner
alter table public.projects enable row level security;
create policy "Team and published projects visible to all authenticated users" on public.projects
  for select using (
    auth.role() = 'authenticated' and (
      workspace in ('team', 'publication') or
      created_by = auth.uid()
    )
  );
create policy "Users can insert own projects" on public.projects
  for insert with check (auth.uid() = created_by);
create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = created_by);
create policy "Users can delete own projects" on public.projects
  for delete using (auth.uid() = created_by);

-- Logo assets RLS
alter table public.logo_assets enable row level security;
create policy "Logo assets viewable by authenticated users" on public.logo_assets
  for select using (auth.role() = 'authenticated');
create policy "Users can insert own logo assets" on public.logo_assets
  for insert with check (auth.uid() = created_by);

-- ------------------------------------------------
-- STORAGE BUCKETS
-- ------------------------------------------------
insert into storage.buckets (id, name, public) values ('logos', 'logos', true);
insert into storage.buckets (id, name, public) values ('projects', 'projects', false);
insert into storage.buckets (id, name, public) values ('images', 'images', true);

-- Storage policies
create policy "Logo bucket is publicly readable" on storage.objects
  for select using (bucket_id = 'logos');
create policy "Authenticated users can upload logos" on storage.objects
  for insert with check (bucket_id = 'logos' and auth.role() = 'authenticated');

create policy "Authenticated users can read project files" on storage.objects
  for select using (bucket_id = 'projects' and auth.role() = 'authenticated');
create policy "Authenticated users can upload project files" on storage.objects
  for insert with check (bucket_id = 'projects' and auth.role() = 'authenticated');

create policy "Images bucket is publicly readable" on storage.objects
  for select using (bucket_id = 'images');
create policy "Authenticated users can upload images" on storage.objects
  for insert with check (bucket_id = 'images' and auth.role() = 'authenticated');
