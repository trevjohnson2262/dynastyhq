import { useEffect, useState, useCallback, useMemo } from 'react';
import { db, realtime } from '../supabaseClient';

// Deterministic per-team rotation so each stamp looks hand-pressed,
// not uniformly digital. Same team always gets the same tilt.
function stampRotation(teamId) {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = (hash * 31 + teamId.charCodeAt(i)) % 1000;
  }
  return (hash % 9) - 4; // -4deg .. +4deg
}

// Given a matchup and "my" team id, return my/opponent scores and side.
function perspective(matchup, teamId) {
  if (!matchup) return null;
  const iAmHome = matchup.home_team_id === teamId;
  return {
    opponentTeamId: iAmHome ? matchup.away_team_id : matchup.home_team_id,
    opponentSchool: iAmHome ? matchup.away_opponent_school : matchup.home_opponent_school,
    myScore: iAmHome ? matchup.home_score : matchup.away_score,
    oppScore: iAmHome ? matchup.away_score : matchup.home_score,
    isHome: iAmHome,
  };
}

export default function ReadyTracker({ league, teams, currentUser, myTeam, isCommissioner, onLeagueUpdate }) {
  const [statuses, setStatuses] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scoreForm, setScoreForm] = useState({ open: false, mine: '', opp: '' });

  const teamName = useMemo(() => {
    const map = {};
    teams.forEach((t) => (map[t.id] = t.name));
    return map;
  }, [teams]);

  const loadData = useCallback(async () => {
    try {
      const [statusData, matchupData] = await Promise.all([
        db.readyStatus.listForWeek(league.id, league.current_week),
        db.matchups.listForWeek(league.id, league.current_week),
      ]);
      setStatuses(statusData);
      setMatchups(matchupData);
    } finally {
      setLoading(false);
    }
  }, [league.id, league.current_week]);

  useEffect(() => {
    setLoading(true);
    loadData();
    const unsubReady = realtime.subscribeToReadyStatus(league.id, () => loadData());
    const unsubMatchups = realtime.subscribeToMatchups(league.id, () => loadData());
    return () => {
      unsubReady();
      unsubMatchups();
    };
  }, [loadData, league.id]);

  const statusByTeam = useMemo(() => {
    const map = {};
    statuses.forEach((s) => {
      map[s.team_id] = s.is_ready;
    });
    return map;
  }, [statuses]);

  const matchupByTeam = useMemo(() => {
    const map = {};
    matchups.forEach((m) => {
      if (m.home_team_id) map[m.home_team_id] = m;
      if (m.away_team_id) map[m.away_team_id] = m;
    });
    return map;
  }, [matchups]);

  const everyoneReady = teams.length > 0 && teams.every((t) => statusByTeam[t.id] === true);

  const myMatchup = myTeam ? matchupByTeam[myTeam.id] : null;
  const myPerspective = myTeam ? perspective(myMatchup, myTeam.id) : null;

  async function handleToggleMyTeam() {
    if (!myTeam) return;
    setBusy(true);
    try {
      const currentlyReady = statusByTeam[myTeam.id] === true;
      await db.readyStatus.setReady(league.id, myTeam.id, league.current_week, !currentlyReady);
    } finally {
      setBusy(false);
    }
  }

  async function handleReportScore(e) {
    e.preventDefault();
    if (!myMatchup || !myTeam) return;
    const mine = Number(scoreForm.mine);
    const opp = Number(scoreForm.opp);
    if (Number.isNaN(mine) || Number.isNaN(opp)) return;
    setBusy(true);
    try {
      const isHome = myMatchup.home_team_id === myTeam.id;
      await db.matchups.reportScore(
        myMatchup.id,
        {
          home_score: isHome ? mine : opp,
          away_score: isHome ? opp : mine,
        },
        currentUser.id
      );
      setScoreForm({ open: false, mine: '', opp: '' });
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvanceWeek() {
    setBusy(true);
    try {
      const updated = await db.leagues.advanceWeek(league.id, league.current_week);
      onLeagueUpdate(updated);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel--tracker">
      <div className="panel__header">
        <h2 className="panel__title">Ready Tracker</h2>
        <span className="panel__subtitle">Week {league.current_week} check-in</span>
      </div>
      <p className="panel__help-text">
        Play your games for the week, then stamp ready — once everyone's in, the
        commissioner advances to the next week.
      </p>
      <div className="panel__body">
        {loading ? (
          <p className="loading-text">Loading the board…</p>
        ) : teams.length === 0 ? (
          <p className="loading-text">No teams yet — ask your commissioner to add some.</p>
        ) : (
          teams.map((team) => {
            const isReady = statusByTeam[team.id] === true;
            const isMine = myTeam && team.id === myTeam.id;
            const matchup = matchupByTeam[team.id];
            const p = perspective(matchup, team.id);

            return (
              <div className={`team-slot ${isReady ? 'team-slot--ready' : ''}`} key={team.id}>
                <div>
                  <div className="team-slot__name">{team.name}</div>
                  {isMine && <span className="team-slot__owner">Your team</span>}
                  <span className="team-slot__opponent">
                    {matchup
                      ? matchup.status === 'final'
                        ? `${p.myScore >= p.oppScore ? 'W' : 'L'} vs ${teamName[p.opponentTeamId] || p.opponentSchool || 'Unknown'} · ${p.myScore}–${p.oppScore}`
                        : `vs ${teamName[p.opponentTeamId] || p.opponentSchool || 'Unknown'}`
                      : 'Bye week'}
                  </span>
                </div>
                <div className="team-slot__status">
                  {isReady ? (
                    <span className="stamp" style={{ '--stamp-rotation': `${stampRotation(team.id)}deg` }}>
                      Ready
                    </span>
                  ) : (
                    <span className="team-slot__empty-label">Awaiting</span>
                  )}
                  {isMine && (
                    <button className="btn btn--ghost btn--small" onClick={handleToggleMyTeam} disabled={busy}>
                      {isReady ? 'Undo' : 'Ready up'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {myTeam && myMatchup && (
          <div className="score-report">
            {myMatchup.status === 'final' ? (
              <div className="score-report__done">
                Result reported: {myPerspective.myScore}–{myPerspective.oppScore} vs{' '}
                {teamName[myPerspective.opponentTeamId] || myPerspective.opponentSchool || 'Unknown'}.{' '}
                <button
                  className="btn btn--ghost btn--small"
                  onClick={() =>
                    setScoreForm({
                      open: true,
                      mine: String(myPerspective.myScore ?? ''),
                      opp: String(myPerspective.oppScore ?? ''),
                    })
                  }
                >
                  Edit
                </button>
              </div>
            ) : !scoreForm.open ? (
              <button
                className="btn btn--field btn--small"
                onClick={() => setScoreForm({ open: true, mine: '', opp: '' })}
              >
                Report result vs {teamName[myPerspective.opponentTeamId] || myPerspective.opponentSchool || 'opponent'}
              </button>
            ) : null}

            {scoreForm.open && (
              <form onSubmit={handleReportScore} className="score-report__form">
                <label className="field-label">Your score</label>
                <input
                  className="text-input schedule-input"
                  type="number"
                  value={scoreForm.mine}
                  onChange={(e) => setScoreForm({ ...scoreForm, mine: e.target.value })}
                  required
                />
                <label className="field-label">Opponent score</label>
                <input
                  className="text-input schedule-input"
                  type="number"
                  value={scoreForm.opp}
                  onChange={(e) => setScoreForm({ ...scoreForm, opp: e.target.value })}
                  required
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--brass btn--small" type="submit" disabled={busy}>
                    Save result
                  </button>
                  <button
                    className="btn btn--ghost btn--small"
                    type="button"
                    onClick={() => setScoreForm({ open: false, mine: '', opp: '' })}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {isCommissioner && (
          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn--brass"
              onClick={handleAdvanceWeek}
              disabled={!everyoneReady || busy || teams.length === 0}
              title={!everyoneReady ? 'Every team needs to stamp ready first' : ''}
            >
              Advance to week {league.current_week + 1}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
