# DynastyHQ

A live, cross-device hub for your dynasty league's weekly check-in and rosters —
built on React + Supabase.

## What's here (v1 scope)

- **Sign in** via email magic link
- **Create or join a league** (share the League ID with your group to join)
- **Ready Tracker** — the war-room board. Each team owner stamps their team
  "Ready" for the week, and can report their result (win/loss + score) for
  that week's matchup right there. The commissioner can advance to the next
  week once everyone's stamped ready. Updates live across every device via
  Supabase Realtime.
- **Schedule** — the commissioner manually enters each week's matchups
  (this app has no way to import a schedule from the game itself, so it's a
  deliberately simple manual entry form). Once a result is reported, the
  score shows up here too.

Not built yet (see the handoff brief from earlier for the full roadmap):
recruiting board, news feed, timeline, announcements.

## Setup

```bash
npm install
npm run dev
```

The app is already pointed at the live Supabase project (URL + publishable key
are defaulted inside `src/supabaseClient.js`). For anything beyond local dev,
copy `.env.example` to `.env` and keep the real values out of source control:

```bash
cp .env.example .env
```

## First run

1. `npm run dev`, open the local URL it prints
2. Sign in with your email (check your inbox for the magic link)
3. Create a league, or join one with a League ID from your commissioner
4. As commissioner: add teams directly in Supabase's Table Editor for now
   (a "create team" UI isn't built yet — quick manual step until that's added),
   assign `owner_id` to each team's `auth.users` id so the right person can
   stamp it ready
5. As commissioner: add this week's matchups from the Schedule panel
6. Have each team owner stamp ready and report their result, then advance
   the week as commissioner

## Migrating an existing project

If your Supabase project was already set up before this update, run
`dynastyhq_schema_matchups_migration.sql` in the SQL Editor — it just adds
the new `matchups` table and its policies, and doesn't touch anything else.

## Deploying

This is a standard Vite + React app — deploy the `dist/` output (from
`npm run build`) to Vercel, Netlify, or any static host. No server-side code
needed; Supabase handles the backend.

## Project structure

```
src/
  supabaseClient.js     Auth, database, and realtime helpers
  hooks/useAuth.js       Session/user state hook
  components/
    Login.jsx             Magic-link sign-in screen
    LeagueGate.jsx         Create/join a league
    LeagueShell.jsx        Scoreboard header + layout wrapper
    ReadyTracker.jsx       Weekly ready-check board + score reporting
    Schedule.jsx           Manually-entered matchup schedule
  styles/global.css       Design tokens and all styling
```
