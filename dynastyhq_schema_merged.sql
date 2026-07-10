-- ============================================================
-- DynastyHQ — Supabase Schema (merged: base schema + matchups)
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query)
-- against a fresh project. This is the full, current schema — no
-- separate migration needed.
-- ============================================================

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- 1. LEAGUES
-- ------------------------------------------------------------
create table leagues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  season int not null default 1,
  current_week int not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. LEAGUE_MEMBERS  (role: 'commissioner' | 'player')
-- ------------------------------------------------------------
create table league_members (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'player' check (role in ('commissioner', 'player')),
  display_name text,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

-- ------------------------------------------------------------
-- 3. TEAMS
-- ------------------------------------------------------------
create table teams (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  abbreviation text,
  logo_url text,
  wins int not null default 0,
  losses int not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. PLAYERS  (roster players, not app users)
-- ------------------------------------------------------------
create table players (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  name text not null,
  position text,
  overall int,
  age int,
  years_pro int,
  status text default 'active',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. READY_STATUS  (per-week readiness ping for advancing the league)
-- ------------------------------------------------------------
create table ready_status (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  week int not null,
  is_ready boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (league_id, team_id, week)
);

-- ------------------------------------------------------------
-- 6a. MATCHUPS  (manually-entered schedule + self-reported scores)
-- ------------------------------------------------------------
create table matchups (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  week int not null,
  home_team_id uuid not null references teams(id) on delete cascade,
  away_team_id uuid not null references teams(id) on delete cascade,
  home_score int,
  away_score int,
  status text not null default 'scheduled' check (status in ('scheduled', 'final')),
  reported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

-- ------------------------------------------------------------
-- 6b. WEEKLY_HISTORY  (snapshot/log of what happened each week)
-- ------------------------------------------------------------
create table weekly_history (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  week int not null,
  summary text,
  data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (league_id, week)
);

-- ------------------------------------------------------------
-- 7. RECRUITS
-- ------------------------------------------------------------
create table recruits (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  name text not null,
  position text,
  stars int check (stars between 1 and 5),
  committed_team_id uuid references teams(id) on delete set null,
  status text default 'uncommitted',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 8. NEWS_ITEMS
-- ------------------------------------------------------------
create table news_items (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  title text not null,
  body text,
  week int,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 9. TIMELINE_EVENTS
-- ------------------------------------------------------------
create table timeline_events (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  week int,
  event_type text,
  description text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 10. ANNOUNCEMENTS  (commissioner-only broadcast messages)
-- ------------------------------------------------------------
create table announcements (
  id uuid primary key default uuid_generate_v4(),
  league_id uuid not null references leagues(id) on delete cascade,
  title text not null,
  body text,
  pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- HELPER FUNCTIONS (used by RLS policies)
-- ============================================================

-- Is the current user a member of a given league?
create or replace function is_league_member(_league_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from league_members
    where league_id = _league_id
      and user_id = auth.uid()
  );
$$;

-- Is the current user the commissioner of a given league?
create or replace function is_commissioner(_league_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from league_members
    where league_id = _league_id
      and user_id = auth.uid()
      and role = 'commissioner'
  );
$$;

-- Does the current user own a given team?
create or replace function owns_team(_team_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from teams
    where id = _team_id
      and owner_id = auth.uid()
  );
$$;

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table ready_status enable row level security;
alter table matchups enable row level security;
alter table weekly_history enable row level security;
alter table recruits enable row level security;
alter table news_items enable row level security;
alter table timeline_events enable row level security;
alter table announcements enable row level security;

-- ============================================================
-- POLICIES
-- ============================================================

-- ---------- LEAGUES ----------
create policy "members can view their league"
  on leagues for select
  using (is_league_member(id));

create policy "authenticated users can create a league"
  on leagues for insert
  with check (auth.uid() = created_by);

create policy "commissioner can update league"
  on leagues for update
  using (is_commissioner(id));

create policy "commissioner can delete league"
  on leagues for delete
  using (is_commissioner(id));

-- ---------- LEAGUE_MEMBERS ----------
create policy "members can view roster of their league"
  on league_members for select
  using (is_league_member(league_id));

create policy "commissioner can add members"
  on league_members for insert
  with check (is_commissioner(league_id) or user_id = auth.uid());

create policy "commissioner can update member roles"
  on league_members for update
  using (is_commissioner(league_id));

create policy "commissioner can remove members"
  on league_members for delete
  using (is_commissioner(league_id));

-- ---------- TEAMS ----------
create policy "members can view teams"
  on teams for select
  using (is_league_member(league_id));

create policy "commissioner can create teams"
  on teams for insert
  with check (is_commissioner(league_id));

create policy "commissioner or owner can update team"
  on teams for update
  using (is_commissioner(league_id) or owner_id = auth.uid());

create policy "commissioner can delete team"
  on teams for delete
  using (is_commissioner(league_id));

-- ---------- PLAYERS ----------
create policy "members can view players"
  on players for select
  using (is_league_member(league_id));

create policy "commissioner can manage players"
  on players for insert
  with check (is_commissioner(league_id));

create policy "commissioner can update players"
  on players for update
  using (is_commissioner(league_id));

create policy "commissioner can delete players"
  on players for delete
  using (is_commissioner(league_id));

-- ---------- READY_STATUS ----------
create policy "members can view ready status"
  on ready_status for select
  using (is_league_member(league_id));

create policy "team owner can set own ready status"
  on ready_status for insert
  with check (is_league_member(league_id) and owns_team(team_id));

create policy "team owner or commissioner can update ready status"
  on ready_status for update
  using (owns_team(team_id) or is_commissioner(league_id));

create policy "commissioner can delete ready status"
  on ready_status for delete
  using (is_commissioner(league_id));

-- ---------- MATCHUPS ----------
create policy "members can view matchups"
  on matchups for select
  using (is_league_member(league_id));

create policy "commissioner can schedule matchups"
  on matchups for insert
  with check (is_commissioner(league_id));

create policy "team owner or commissioner can update matchup"
  on matchups for update
  using (
    is_commissioner(league_id)
    or owns_team(home_team_id)
    or owns_team(away_team_id)
  );

create policy "commissioner can delete matchups"
  on matchups for delete
  using (is_commissioner(league_id));

-- ---------- WEEKLY_HISTORY ----------
create policy "members can view weekly history"
  on weekly_history for select
  using (is_league_member(league_id));

create policy "commissioner can write weekly history"
  on weekly_history for insert
  with check (is_commissioner(league_id));

create policy "commissioner can update weekly history"
  on weekly_history for update
  using (is_commissioner(league_id));

create policy "commissioner can delete weekly history"
  on weekly_history for delete
  using (is_commissioner(league_id));

-- ---------- RECRUITS ----------
create policy "members can view recruits"
  on recruits for select
  using (is_league_member(league_id));

create policy "commissioner can manage recruits"
  on recruits for insert
  with check (is_commissioner(league_id));

create policy "commissioner can update recruits"
  on recruits for update
  using (is_commissioner(league_id));

create policy "commissioner can delete recruits"
  on recruits for delete
  using (is_commissioner(league_id));

-- ---------- NEWS_ITEMS ----------
create policy "members can view news"
  on news_items for select
  using (is_league_member(league_id));

create policy "commissioner can post news"
  on news_items for insert
  with check (is_commissioner(league_id));

create policy "commissioner can update news"
  on news_items for update
  using (is_commissioner(league_id));

create policy "commissioner can delete news"
  on news_items for delete
  using (is_commissioner(league_id));

-- ---------- TIMELINE_EVENTS ----------
create policy "members can view timeline"
  on timeline_events for select
  using (is_league_member(league_id));

create policy "commissioner can add timeline events"
  on timeline_events for insert
  with check (is_commissioner(league_id));

create policy "commissioner can update timeline events"
  on timeline_events for update
  using (is_commissioner(league_id));

create policy "commissioner can delete timeline events"
  on timeline_events for delete
  using (is_commissioner(league_id));

-- ---------- ANNOUNCEMENTS ----------
create policy "members can view announcements"
  on announcements for select
  using (is_league_member(league_id));

create policy "commissioner can post announcements"
  on announcements for insert
  with check (is_commissioner(league_id));

create policy "commissioner can update announcements"
  on announcements for update
  using (is_commissioner(league_id));

create policy "commissioner can delete announcements"
  on announcements for delete
  using (is_commissioner(league_id));

-- ============================================================
-- REALTIME
-- Enable realtime replication for tables that need live updates.
-- (Do this via Dashboard → Database → Replication → toggle these tables,
--  or run the following if your project supports it via SQL.)
-- ============================================================
alter publication supabase_realtime add table ready_status;
alter publication supabase_realtime add table matchups;
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table weekly_history;
alter publication supabase_realtime add table news_items;
alter publication supabase_realtime add table timeline_events;
alter publication supabase_realtime add table announcements;

-- ============================================================
-- HANDY INDEXES
-- ============================================================
create index idx_league_members_league on league_members(league_id);
create index idx_teams_league on teams(league_id);
create index idx_players_league on players(league_id);
create index idx_players_team on players(team_id);
create index idx_ready_status_league_week on ready_status(league_id, week);
create index idx_matchups_league_week on matchups(league_id, week);
create index idx_weekly_history_league on weekly_history(league_id);
create index idx_recruits_league on recruits(league_id);
create index idx_news_items_league on news_items(league_id);
create index idx_timeline_events_league on timeline_events(league_id);
create index idx_announcements_league on announcements(league_id);
