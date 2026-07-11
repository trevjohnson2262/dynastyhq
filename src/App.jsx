import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { auth, db, realtime } from './supabaseClient';
import Login from './components/Login';
import LeagueGate from './components/LeagueGate';
import LeagueShell from './components/LeagueShell';
import ReadyTracker from './components/ReadyTracker';
import Schedule from './components/Schedule';
import Teams from './components/Teams';
import RecruitingBoard from './components/RecruitingBoard';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const [league, setLeague] = useState(null);
  const [teams, setTeams] = useState([]);
  const [role, setRole] = useState(null);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const loadTeams = useCallback(async (leagueId) => {
    setTeamsLoading(true);
    try {
      const data = await db.teams.list(leagueId);
      setTeams(data);
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!league) return;
    loadTeams(league.id);
    auth.getRoleInLeague(league.id).then(setRole);
    const unsubscribe = realtime.subscribeToTeams(league.id, () => loadTeams(league.id));
    return unsubscribe;
  }, [league, loadTeams]);

  if (authLoading) {
    return (
      <div className="centered-screen">
        <p className="loading-text">Loading DynastyHQ…</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (!league) {
    return <LeagueGate onSelect={setLeague} />;
  }

  const myTeam = teams.find((t) => t.owner_id === user.id) || null;
  const isCommissioner = role === 'commissioner';

  return (
    <LeagueShell league={league} onLeaveLeague={() => setLeague(null)}>
      <div className="main-grid">
        {teamsLoading ? (
          <p className="loading-text">Loading teams…</p>
        ) : (
          <>
            <Teams
              league={league}
              teams={teams}
              currentUser={user}
              myTeam={myTeam}
              isCommissioner={isCommissioner}
            />
            <ReadyTracker
              league={league}
              teams={teams}
              currentUser={user}
              myTeam={myTeam}
              isCommissioner={isCommissioner}
              onLeagueUpdate={setLeague}
            />
            <Schedule league={league} teams={teams} isCommissioner={isCommissioner} />
            <RecruitingBoard league={league} teams={teams} isCommissioner={isCommissioner} />
          </>
        )}
      </div>
    </LeagueShell>
  );
}
