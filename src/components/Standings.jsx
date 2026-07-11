import { useState, useEffect, useCallback, useMemo } from 'react';
import { db, realtime } from '../supabaseClient';

export default function Standings({ league, teams }) {
  const [matchups, setMatchups] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await db.matchups.listForLeague(league.id);
      setMatchups(data);
    } finally {
      setLoading(false);
    }
  }, [league.id]);

  useEffect(() => {
    setLoading(true);
    load();
    const unsubscribe = realtime.subscribeToMatchups(league.id, () => load());
    return unsubscribe;
  }, [load, league.id]);

  const standings = useMemo(() => {
    const records = new Map();
    teams.forEach((t) => records.set(t.id, { team: t, wins: 0, losses: 0, pf: 0, pa: 0 }));

    matchups
      .filter((m) => m.status === 'final')
      .forEach((m) => {
        const home = records.get(m.home_team_id);
        const away = records.get(m.away_team_id);
        if (!home || !away) return;
        home.pf += m.home_score;
        home.pa += m.away_score;
        away.pf += m.away_score;
        away.pa += m.home_score;
        if (m.home_score > m.away_score) {
          home.wins += 1;
          away.losses += 1;
        } else if (m.away_score > m.home_score) {
          away.wins += 1;
          home.losses += 1;
        }
      });

    return [...records.values()].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const diffA = a.pf - a.pa;
      const diffB = b.pf - b.pa;
      if (diffB !== diffA) return diffB - diffA;
      return a.team.name.localeCompare(b.team.name);
    });
  }, [teams, matchups]);

  return (
    <section className="panel panel--tracker panel--full-width">
      <div className="panel__header">
        <h2 className="panel__title">Standings</h2>
        <span className="panel__subtitle">Season {league.season}</span>
      </div>
      <div className="panel__body">
        {loading ? (
          <p className="loading-text">Loading standings…</p>
        ) : teams.length === 0 ? (
          <p className="loading-text">No teams yet.</p>
        ) : (
          <table className="standings-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>W</th>
                <th>L</th>
                <th>PF</th>
                <th>PA</th>
                <th>Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr key={row.team.id}>
                  <td className="standings-table__team">{row.team.name}</td>
                  <td>{row.wins}</td>
                  <td>{row.losses}</td>
                  <td>{row.pf}</td>
                  <td>{row.pa}</td>
                  <td>{row.pf - row.pa > 0 ? `+${row.pf - row.pa}` : row.pf - row.pa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
