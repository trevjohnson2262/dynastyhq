import { useEffect, useState, useCallback, useMemo } from 'react';
import { db, realtime } from '../supabaseClient';

export default function Schedule({ league, teams, isCommissioner }) {
  const [matchups, setMatchups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ week: league.current_week, home: '', away: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const teamName = useMemo(() => {
    const map = {};
    teams.forEach((t) => (map[t.id] = t.name));
    return map;
  }, [teams]);

  const loadMatchups = useCallback(async () => {
    try {
      const data = await db.matchups.listForLeague(league.id);
      setMatchups(data);
    } finally {
      setLoading(false);
    }
  }, [league.id]);

  useEffect(() => {
    setLoading(true);
    loadMatchups();
    const unsubscribe = realtime.subscribeToMatchups(league.id, () => loadMatchups());
    return unsubscribe;
  }, [loadMatchups, league.id]);

  const byWeek = useMemo(() => {
    const grouped = {};
    matchups.forEach((m) => {
      grouped[m.week] = grouped[m.week] || [];
      grouped[m.week].push(m);
    });
    return Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)
      .map((week) => ({ week, games: grouped[week] }));
  }, [matchups]);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!form.home || !form.away) return;
    if (form.home === form.away) {
      setError('Home and away team need to be different.');
      return;
    }
    setBusy(true);
    try {
      await db.matchups.create({
        league_id: league.id,
        week: Number(form.week),
        home_team_id: form.home,
        away_team_id: form.away,
      });
      setForm({ week: form.week, home: '', away: '' });
      setShowAddForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id) {
    await db.matchups.remove(id);
  }

  return (
    <section className="panel panel--schedule">
      <div className="panel__header">
        <h2 className="panel__title">Schedule</h2>
        <span className="panel__subtitle">Full season</span>
      </div>
      <div className="panel__body">
        {loading ? (
          <p className="loading-text" style={{ color: '#6b6350' }}>
            Loading schedule…
          </p>
        ) : byWeek.length === 0 ? (
          <p className="schedule-empty">
            No games scheduled yet{isCommissioner ? ' — add the first one below.' : '.'}
          </p>
        ) : (
          byWeek.map(({ week, games }) => (
            <div key={week} className="schedule-week">
              <div className="schedule-week__label">
                Week {week}
                {week === league.current_week ? ' · current' : ''}
              </div>
              <table className="schedule-table">
                <tbody>
                  {games.map((m) => (
                    <tr key={m.id}>
                      <td className="schedule-table__matchup">
                        {teamName[m.home_team_id] || 'Unknown'} vs {teamName[m.away_team_id] || 'Unknown'}
                      </td>
                      <td className="schedule-table__score">
                        {m.status === 'final' ? `${m.home_score} – ${m.away_score}` : 'Not yet played'}
                      </td>
                      {isCommissioner && (
                        <td className="schedule-table__actions">
                          <button
                            className="btn btn--ghost btn--small"
                            onClick={() => handleRemove(m.id)}
                            aria-label={`Remove ${teamName[m.home_team_id]} vs ${teamName[m.away_team_id]} from week ${week}`}
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        {isCommissioner && (
          <div style={{ marginTop: 16 }}>
            {!showAddForm ? (
              <button className="btn btn--field btn--small" onClick={() => setShowAddForm(true)}>
                + Add matchup
              </button>
            ) : (
              <form onSubmit={handleAdd} className="schedule-add-form">
                <div>
                  <label className="field-label" style={{ color: '#6b6350' }}>
                    Week
                  </label>
                  <input
                    className="text-input schedule-input"
                    type="number"
                    min="1"
                    value={form.week}
                    onChange={(e) => setForm({ ...form, week: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="field-label" style={{ color: '#6b6350' }}>
                    Home
                  </label>
                  <select
                    className="roster-select schedule-input"
                    value={form.home}
                    onChange={(e) => setForm({ ...form, home: e.target.value })}
                    required
                  >
                    <option value="">Select team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" style={{ color: '#6b6350' }}>
                    Away
                  </label>
                  <select
                    className="roster-select schedule-input"
                    value={form.away}
                    onChange={(e) => setForm({ ...form, away: e.target.value })}
                    required
                  >
                    <option value="">Select team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="btn btn--field btn--small" type="submit" disabled={busy}>
                  Save
                </button>
              </form>
            )}
            {error && <p className="auth-status auth-status--error">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
