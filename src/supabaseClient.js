// ============================================================
// DynastyHQ — Supabase client, auth, database, and realtime layer
// ============================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://adppgaqyvlhhjvevvrxw.supabase.co';
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_NgCQRQSq5UGuQRD_wS6Pxw_Q9jPMPYA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

if (import.meta.env.DEV) {
  window.supabase = supabase;
}

// ============================================================
// AUTH
// ============================================================
export const auth = {
  async signInWithMagicLink(email, redirectTo = window.location.origin) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  },

  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return () => data.subscription.unsubscribe();
  },

  async getRoleInLeague(leagueId) {
    const user = await this.getCurrentUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single();
    if (error) return null;
    return data.role;
  },
};

// ============================================================
// DATABASE
// ============================================================
export const db = {
  leagues: {
    async list() {
      // RLS already restricts this to leagues the caller belongs to.
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async get(id) {
      const { data, error } = await supabase.from('leagues').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async create({ name, season = 1 }) {
      const user = await auth.getCurrentUser();
      if (!user) throw new Error('Must be signed in to create a league');
      const { data: league, error } = await supabase
        .from('leagues')
        .insert({ name, season, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      const { error: memberErr } = await supabase
        .from('league_members')
        .insert({ league_id: league.id, user_id: user.id, role: 'commissioner' });
      if (memberErr) throw memberErr;
      return league;
    },

    async joinById(leagueId, displayName = null) {
      const user = await auth.getCurrentUser();
      if (!user) throw new Error('Must be signed in to join a league');
      const { data, error } = await supabase
        .from('league_members')
        .insert({ league_id: leagueId, user_id: user.id, role: 'player', display_name: displayName })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async advanceWeek(id, currentWeek) {
      const { data, error } = await supabase
        .from('leagues')
        .update({ current_week: currentWeek + 1 })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async startNewSeason(id, currentSeason) {
      const { data, error } = await supabase
        .from('leagues')
        .update({ season: currentSeason + 1, current_week: 1 })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  },

  teams: {
    async list(leagueId) {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('league_id', leagueId)
        .order('name');
      if (error) throw error;
      return data;
    },
    async create(row) {
      const { data, error } = await supabase.from('teams').insert(row).select().single();
      if (error) throw error;
      return data;
    },
    async claim(teamId, userId) {
      const { data, error } = await supabase
        .from('teams')
        .update({ owner_id: userId })
        .eq('id', teamId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async update(id, patch) {
      const { data, error } = await supabase
        .from('teams')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await supabase.from('teams').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  },

  matchups: {
    async listForLeague(leagueId) {
      const { data, error } = await supabase
        .from('matchups')
        .select('*')
        .eq('league_id', leagueId)
        .order('week', { ascending: true });
      if (error) throw error;
      return data;
    },

    async listForWeek(leagueId, week) {
      const { data, error } = await supabase
        .from('matchups')
        .select('*')
        .eq('league_id', leagueId)
        .eq('week', week);
      if (error) throw error;
      return data;
    },

    async create({ league_id, week, home_team_id, away_team_id }) {
      const { data, error } = await supabase
        .from('matchups')
        .insert({ league_id, week, home_team_id, away_team_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async reportScore(matchupId, { home_score, away_score }, reporterId) {
      const { data, error } = await supabase
        .from('matchups')
        .update({
          home_score,
          away_score,
          status: 'final',
          reported_by: reporterId,
        })
        .eq('id', matchupId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await supabase.from('matchups').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  },

  recruits: {
    async list(leagueId) {
      const { data, error } = await supabase
        .from('recruits')
        .select('*')
        .eq('league_id', leagueId)
        .order('season', { ascending: false })
        .order('stars', { ascending: false });
      if (error) throw error;
      return data;
    },

    async create({ league_id, name, position, stars, season }) {
      const { data, error } = await supabase
        .from('recruits')
        .insert({ league_id, name, position, stars, season })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async commit(recruitId, teamId) {
      const { data, error } = await supabase
        .from('recruits')
        .update({ committed_team_id: teamId, status: 'committed' })
        .eq('id', recruitId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async uncommit(recruitId) {
      const { data, error } = await supabase
        .from('recruits')
        .update({ committed_team_id: null, status: 'uncommitted' })
        .eq('id', recruitId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await supabase.from('recruits').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  },

  readyStatus: {
    async listForWeek(leagueId, week) {
      const { data, error } = await supabase
        .from('ready_status')
        .select('*')
        .eq('league_id', leagueId)
        .eq('week', week);
      if (error) throw error;
      return data;
    },

    async setReady(leagueId, teamId, week, isReady) {
      const { data, error } = await supabase
        .from('ready_status')
        .upsert(
          {
            league_id: leagueId,
            team_id: teamId,
            week,
            is_ready: isReady,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'league_id,team_id,week' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
  },

  timelineEvents: {
    async list(leagueId) {
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async create({ league_id, week, event_type, description }) {
      const { data, error } = await supabase
        .from('timeline_events')
        .insert({ league_id, week, event_type, description })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await supabase.from('timeline_events').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  },

  newsItems: {
    async list(leagueId) {
      const { data, error } = await supabase
        .from('news_items')
        .select('*')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async create({ league_id, title, body, week, created_by }) {
      const { data, error } = await supabase
        .from('news_items')
        .insert({ league_id, title, body, week, created_by })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await supabase.from('news_items').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  },

  announcements: {
    async list(leagueId) {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('league_id', leagueId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    async create({ league_id, title, body, created_by }) {
      const { data, error } = await supabase
        .from('announcements')
        .insert({ league_id, title, body, created_by })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async setPinned(id, pinned) {
      const { data, error } = await supabase
        .from('announcements')
        .update({ pinned })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  },
};

// ============================================================
// REALTIME
// ============================================================
function subscribeToTable(table, leagueId, callback) {
  const channel = supabase
    .channel(`${table}:${leagueId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `league_id=eq.${leagueId}` },
      (payload) => callback(payload)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export const realtime = {
  subscribeToReadyStatus(leagueId, callback) {
    return subscribeToTable('ready_status', leagueId, callback);
  },
  subscribeToTeams(leagueId, callback) {
    return subscribeToTable('teams', leagueId, callback);
  },
  subscribeToMatchups(leagueId, callback) {
    return subscribeToTable('matchups', leagueId, callback);
  },
  subscribeToNews(leagueId, callback) {
    return subscribeToTable('news_items', leagueId, callback);
  },
  subscribeToTimeline(leagueId, callback) {
    return subscribeToTable('timeline_events', leagueId, callback);
  },
  subscribeToAnnouncements(leagueId, callback) {
    return subscribeToTable('announcements', leagueId, callback);
  },
  subscribeToLeague(leagueId, callback) {
    const channel = supabase
      .channel(`leagues:${leagueId}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leagues', filter: `id=eq.${leagueId}` },
        (payload) => callback(payload)
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },
};
