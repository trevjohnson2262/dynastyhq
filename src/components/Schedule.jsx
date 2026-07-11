import { useEffect, useState, useCallback, useMemo } from 'react';
import { db, realtime } from '../supabaseClient';
import { SCHOOLS_BY_CONFERENCE, SCHOOL_LOOKUP } from '../lib/schools';

// Select values are prefixed so we can tell a league team apart from a
// non-league (e.g. CPU) opponent picked from the full 138-school list.
function encodeTeam(id) {
  return `team:${id}`;
}
function encodeSchool(school) {
  return `school:${school}`;
}
function decodeSide(value) {
  if (value.startsWith('team:')) {
    return { team_id: value.slice(5), opponent_school: null };
  }
  if (value.startsWith('school:')) {
    const picked = SCHOOL_LOOKUP.get(value.slice(7));
    return { team_id: null, opponent_school: picked ? `${picked.school} ${picked.nickname}` : value.slice(7) };
  }
  return { team_id: null, opponent_school: null };
}

function TeamAndSchoolOptions({ teams, usedSchools }) {
  return (
    <>
      {teams.length > 0 && (
        <optgroup label="League Teams">
          {teams.map((t) => (
            <option key={encodeTeam(t.id)} value={encodeTeam(t.id)}>
              {t.name}
            </option>
          ))}
        </optgroup>
      )}
      {SCHOOLS_BY_CONFERENCE.map(([conference, schools]) => (
        <optgroup key={conference} label={conference}>
          {schools.map((s) => (
            <option
              key={encodeSchool(s.school)}
              value={encodeSchool(s.school)}
              disabled={usedSchools.has(s.school)}
            >
              {s.school} {s.nickname}
              {usedSchools.has(s.school) ? ' (a league team — pick it above)' : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

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

  const usedSchools = useMemo(() => new Set(teams.map((t) => t.school).filter(Boolean)), [teams]);

  function sideLabel(teamId, opponentSchool) {
    if (teamId) return teamName[teamId] || 'Unknown';
    return opponentSchool || 'Unknown';
  }

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
      const home = decodeSide(form.home);
      const away = decodeSide(form.away);
      await db.matchups.create({
        league_id: league.id,
        week: Number(form.week),
        home_team_id: home.team_id,
        away_team_id: away.team_id,
        home_opponent_school: home.opponent_school,
        away_opponent_school: away.opponent_school,
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
                        {sideLabel(m.home_team_id, m.home_opponent_school)} vs{' '}
                        {sideLabel(m.away_team_id, m.away_opponent_school)}
                      </td>
                      <td className="schedule-table__score">
                        {m.status === 'final' ? `${m.home_score} – ${m.away_score}` : 'Not yet played'}
                      </td>
                      {isCommissioner && (
                        <td className="schedule-table__actions">
                          <button
                            className="btn btn--ghost btn--small"
                            onClick={() => handleRemove(m.id)}
                            aria-label={`Remove ${sideLabel(m.home_team_id, m.home_opponent_school)} vs ${sideLabel(m.away_team_id, m.away_opponent_school)} from week ${week}`}
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
                    <TeamAndSchoolOptions teams={teams} usedSchools={usedSchools} />
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
                    <TeamAndSchoolOptions teams={teams} usedSchools={usedSchools} />
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
