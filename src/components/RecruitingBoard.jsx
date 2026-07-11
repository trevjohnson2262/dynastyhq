import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../supabaseClient';

function Stars({ count }) {
  return (
    <span className="recruit-stars" aria-label={`${count} star recruit`}>
      {'★'.repeat(count)}
      {'☆'.repeat(5 - count)}
    </span>
  );
}

export default function RecruitingBoard({ league, teams, isCommissioner }) {
  const [recruits, setRecruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    position: '',
    stars: '3',
    season: league.season,
  });
  const [committingId, setCommittingId] = useState(null);
  const [commitTeamId, setCommitTeamId] = useState('');

  const teamName = useMemo(() => {
    const map = {};
    teams.forEach((t) => (map[t.id] = t.name));
    return map;
  }, [teams]);

  const bySeason = useMemo(() => {
    const groups = new Map();
    recruits.forEach((r) => {
      const key = r.season ?? 'Unspecified';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    return [...groups.entries()];
  }, [recruits]);

  const load = useCallback(async () => {
    try {
      const data = await db.recruits.list(league.id);
      setRecruits(data);
    } finally {
      setLoading(false);
    }
  }, [league.id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await db.recruits.create({
        league_id: league.id,
        name: form.name.trim(),
        position: form.position.trim() || null,
        stars: Number(form.stars),
        season: form.season ? Number(form.season) : null,
      });
      setForm({ name: '', position: '', stars: '3', season: league.season });
      setShowAddForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCommit(recruitId) {
    if (!commitTeamId) return;
    setBusy(true);
    setError('');
    try {
      await db.recruits.commit(recruitId, commitTeamId);
      setCommittingId(null);
      setCommitTeamId('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUncommit(recruitId) {
    setBusy(true);
    setError('');
    try {
      await db.recruits.uncommit(recruitId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(recruitId) {
    setBusy(true);
    setError('');
    try {
      await db.recruits.remove(recruitId);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel--schedule panel--full-width">
      <div className="panel__header">
        <h2 className="panel__title">Recruiting Classes</h2>
        <span className="panel__subtitle">{recruits.length} signed</span>
      </div>
      <div className="panel__body">
        {loading ? (
          <p className="loading-text" style={{ color: '#6b6350' }}>
            Loading recruiting classes…
          </p>
        ) : recruits.length === 0 ? (
          <p className="schedule-empty">
            No recruits logged yet{isCommissioner ? ' — add your first signee below.' : '.'}
          </p>
        ) : (
          bySeason.map(([season, group]) => (
            <div key={season} className="recruit-season-group">
              <div className="schedule-week__label">
                {season === 'Unspecified' ? 'Season unspecified' : `Season ${season}`}
              </div>
              <div className="recruit-list">
                {group.map((r) => (
                  <div className="recruit-row" key={r.id}>
                    <div>
                      <span className="recruit-row__name">{r.name}</span>
                      {r.position && <span className="recruit-row__position">{r.position}</span>}
                      <Stars count={r.stars || 0} />
                    </div>
                    <div className="recruit-row__status">
                      {r.status === 'committed' ? (
                        <span className="recruit-row__committed">
                          Signed with {teamName[r.committed_team_id] || 'Unknown'}
                        </span>
                      ) : (
                        <span className="recruit-row__uncommitted">Uncommitted</span>
                      )}

                      {isCommissioner && (
                        <div className="recruit-row__actions">
                          {r.status === 'committed' ? (
                            <button
                              className="btn btn--ghost btn--small"
                              onClick={() => handleUncommit(r.id)}
                              disabled={busy}
                            >
                              Uncommit
                            </button>
                          ) : committingId === r.id ? (
                            <>
                              <select
                                className="roster-select"
                                value={commitTeamId}
                                onChange={(e) => setCommitTeamId(e.target.value)}
                              >
                                <option value="">Select team</option>
                                {teams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="btn btn--field btn--small"
                                onClick={() => handleCommit(r.id)}
                                disabled={busy || !commitTeamId}
                              >
                                Confirm
                              </button>
                              <button
                                className="btn btn--ghost btn--small"
                                type="button"
                                onClick={() => setCommittingId(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              className="btn btn--field btn--small"
                              onClick={() => setCommittingId(r.id)}
                              disabled={busy}
                            >
                              Sign to team
                            </button>
                          )}
                          <button
                            className="btn btn--ghost btn--small"
                            onClick={() => handleRemove(r.id)}
                            disabled={busy}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {error && <p className="auth-status auth-status--error">{error}</p>}

        {isCommissioner && (
          <div style={{ marginTop: 16 }}>
            {!showAddForm ? (
              <button className="btn btn--field btn--small" onClick={() => setShowAddForm(true)}>
                + Add recruit
              </button>
            ) : (
              <form onSubmit={handleAdd} className="recruit-add-form">
                <div>
                  <label className="field-label" style={{ color: '#6b6350' }}>
                    Name
                  </label>
                  <input
                    className="text-input schedule-input"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="field-label" style={{ color: '#6b6350' }}>
                    Position
                  </label>
                  <input
                    className="text-input schedule-input"
                    type="text"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="QB"
                  />
                </div>
                <div>
                  <label className="field-label" style={{ color: '#6b6350' }}>
                    Stars
                  </label>
                  <select
                    className="roster-select schedule-input"
                    value={form.stars}
                    onChange={(e) => setForm({ ...form, stars: e.target.value })}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" style={{ color: '#6b6350' }}>
                    Season
                  </label>
                  <input
                    className="text-input schedule-input"
                    type="number"
                    min="1"
                    value={form.season}
                    onChange={(e) => setForm({ ...form, season: e.target.value })}
                  />
                </div>
                <button className="btn btn--field btn--small" type="submit" disabled={busy}>
                  Add recruit
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
