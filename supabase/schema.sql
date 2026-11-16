-- DM Table schema. Run this in the Supabase SQL editor.
-- Safe to run again: it only creates what is missing and drops the retired worlds layer.
-- Then set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.

create extension if not exists pgcrypto;

-- Campaigns used to belong to a worlds table. Existing projects still have
-- campaigns.world_id as not null, and inserts fail until that column is gone.
-- Drop it before the rest of this script so a later failure cannot leave it behind.
do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'worlds'
  ) then
    alter publication supabase_realtime drop table public.worlds;
  end if;
end
$$;

alter table if exists public.campaigns drop column if exists world_id cascade;
drop table if exists public.worlds cascade;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#e0a45a',
  overview jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  section text not null check (section in (
    'story-beats', 'pcs', 'npcs', 'monsters', 'afflictions', 'locations', 'maps', 'misc'
  )),
  subsection text not null default '',
  name text not null,
  body jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_key text not null,
  label text not null,
  linked_entry_id uuid references public.entries (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_entry_id uuid not null references public.entries (id) on delete cascade,
  target_entry_id uuid not null references public.entries (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source_entry_id, target_entry_id),
  check (source_entry_id <> target_entry_id)
);

create index if not exists campaigns_user_idx on public.campaigns (user_id);
create index if not exists entries_campaign_section_idx on public.entries (campaign_id, section);
create index if not exists list_items_entry_idx on public.list_items (entry_id);
create index if not exists links_campaign_idx on public.links (campaign_id);
create index if not exists links_target_idx on public.links (target_entry_id);

create table if not exists public.plot_subsections (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  subsection_id uuid not null references public.plot_subsections (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('session', 'arc')),
  name text not null,
  session_date date,
  body jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  resolved boolean not null default false,
  show_on_home boolean not null default false,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plot_subsections_campaign_idx on public.plot_subsections (campaign_id);
create index if not exists story_items_campaign_idx on public.story_items (campaign_id, kind);

alter table public.story_items add column if not exists image_path text;

create table if not exists public.pc_sheets (
  entry_id uuid primary key references public.entries (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  class_name text not null default '',
  subclass text not null default '',
  sheet_url text not null default '',
  bio jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  subclass_notes jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  people jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  objectives jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pc_sheets_campaign_idx on public.pc_sheets (campaign_id);

create table if not exists public.npc_sheets (
  entry_id uuid primary key references public.entries (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  motivations jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  affinity integer not null default 0,
  hostile_at integer not null default -1,
  friendly_at integer not null default 1,
  people jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists npc_sheets_campaign_idx on public.npc_sheets (campaign_id);

create table if not exists public.catalog_sheets (
  entry_id uuid primary key references public.entries (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('affliction', 'location', 'item')),
  saving_throw text not null default '',
  damage text not null default '',
  place text not null default '',
  effect text not null default '',
  notes jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_sheets_campaign_idx on public.catalog_sheets (campaign_id);

create table if not exists public.monster_sheets (
  entry_id uuid primary key references public.entries (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  size text not null default '',
  creature_type text not null default '',
  alignment text not null default '',
  armor_class text not null default '',
  hit_points text not null default '',
  speed text not null default '',
  abilities jsonb not null default '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}'::jsonb,
  saving_throws text not null default '',
  skills text not null default '',
  damage_vulnerabilities text not null default '',
  damage_resistances text not null default '',
  damage_immunities text not null default '',
  condition_immunities text not null default '',
  senses text not null default '',
  languages text not null default '',
  challenge text not null default '',
  traits jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  bonus_actions jsonb not null default '[]'::jsonb,
  reactions jsonb not null default '[]'::jsonb,
  legendary_actions jsonb not null default '[]'::jsonb,
  notes jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  source text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monster_sheets_campaign_idx on public.monster_sheets (campaign_id);

create table if not exists public.sticky_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null default '',
  character_id uuid references public.entries (id) on delete set null,
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sticky_notes_campaign_idx on public.sticky_notes (campaign_id);

alter table public.sticky_notes add column if not exists sort_index integer not null default 0;

drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

drop trigger if exists entries_updated_at on public.entries;
create trigger entries_updated_at
before update on public.entries
for each row execute function public.set_updated_at();

drop trigger if exists plot_subsections_updated_at on public.plot_subsections;
create trigger plot_subsections_updated_at
before update on public.plot_subsections
for each row execute function public.set_updated_at();

drop trigger if exists story_items_updated_at on public.story_items;
create trigger story_items_updated_at
before update on public.story_items
for each row execute function public.set_updated_at();

drop trigger if exists pc_sheets_updated_at on public.pc_sheets;
create trigger pc_sheets_updated_at
before update on public.pc_sheets
for each row execute function public.set_updated_at();

drop trigger if exists npc_sheets_updated_at on public.npc_sheets;
create trigger npc_sheets_updated_at
before update on public.npc_sheets
for each row execute function public.set_updated_at();

drop trigger if exists catalog_sheets_updated_at on public.catalog_sheets;
create trigger catalog_sheets_updated_at
before update on public.catalog_sheets
for each row execute function public.set_updated_at();

drop trigger if exists monster_sheets_updated_at on public.monster_sheets;
create trigger monster_sheets_updated_at
before update on public.monster_sheets
for each row execute function public.set_updated_at();

drop trigger if exists sticky_notes_updated_at on public.sticky_notes;
create trigger sticky_notes_updated_at
before update on public.sticky_notes
for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;
alter table public.entries enable row level security;
alter table public.list_items enable row level security;
alter table public.links enable row level security;
alter table public.plot_subsections enable row level security;
alter table public.story_items enable row level security;
alter table public.pc_sheets enable row level security;
alter table public.npc_sheets enable row level security;
alter table public.catalog_sheets enable row level security;
alter table public.monster_sheets enable row level security;
alter table public.sticky_notes enable row level security;

drop policy if exists "campaigns_all" on public.campaigns;
create policy "campaigns_all" on public.campaigns
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "entries_all" on public.entries;
create policy "entries_all" on public.entries
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "list_items_all" on public.list_items;
create policy "list_items_all" on public.list_items
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "links_all" on public.links;
create policy "links_all" on public.links
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "plot_subsections_all" on public.plot_subsections;
create policy "plot_subsections_all" on public.plot_subsections
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "story_items_all" on public.story_items;
create policy "story_items_all" on public.story_items
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "pc_sheets_all" on public.pc_sheets;
create policy "pc_sheets_all" on public.pc_sheets
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "npc_sheets_all" on public.npc_sheets;
create policy "npc_sheets_all" on public.npc_sheets
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "catalog_sheets_all" on public.catalog_sheets;
create policy "catalog_sheets_all" on public.catalog_sheets
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "monster_sheets_all" on public.monster_sheets;
create policy "monster_sheets_all" on public.monster_sheets
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "sticky_notes_all" on public.sticky_notes;
create policy "sticky_notes_all" on public.sticky_notes
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete on public.campaigns, public.entries, public.list_items, public.links, public.plot_subsections, public.story_items, public.pc_sheets, public.npc_sheets, public.catalog_sheets, public.monster_sheets, public.sticky_notes to authenticated;

notify pgrst, 'reload schema';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-media',
  'campaign-media',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "campaign_media_read" on storage.objects;
create policy "campaign_media_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'campaign-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "campaign_media_insert" on storage.objects;
create policy "campaign_media_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'campaign-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "campaign_media_update" on storage.objects;
create policy "campaign_media_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'campaign-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "campaign_media_delete" on storage.objects;
create policy "campaign_media_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'campaign-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
