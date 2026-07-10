import { useState } from 'react';
import { db } from '../supabaseClient';

export default function Teams({ league, teams, currentUser, myTeam, isCommissioner }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', abbreviation: '' });

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await db.teams.create({
        league_id: league.id,
        name: form.name.trim(),
        abbreviation: form.abbreviation.trim() || null,
      });
      setForm({ name: '', abbreviation: '' });
      setShowAddForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleClaim(teamId) {
    setBusy(true);
    setError('');
    try {
      await db.teams.claim(teamId, currentUser.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel--tracker panel--full-width">
      <div className="panel__header">
        <h2 className="panel__title">Teams</h2>
        <span className="panel__subtitle">{teams.length} in the league</span>
      </div>
      <div className="panel__body">
        {teams.length === 0 ? (
          <p className="loading-text">
            No teams yet{isCommissioner ? ' — add the first one below.' : '.'}
          </p>
        ) : (
          <div className="team-roster">
            {teams.map((team) => (
              <div className="team-roster__row" key={team.id}>
                <div>
                  <span className="team-roster__name">{team.name}</span>
                  {team.abbreviation && <span className="team-roster__abbr">{team.abbreviation}</span>}
                </div>
                <div className="team-roster__status">
                  {team.owner_id === currentUser.id ? (
                    <span className="team-roster__owned-label">Your team</span>
                  ) : team.owner_id ? (
                    <span className="team-roster__owned-label">Claimed</span>
                  ) : !myTeam ? (
                    <button
                      className="btn btn--field btn--small"
                      onClick={() => handleClaim(team.id)}
                      disabled={busy}
                    >
                      Claim this team
                    </button>
                  ) : (
                    <span className="team-roster__owned-label">Unclaimed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="auth-status auth-status--error">{error}</p>}

        {isCommissioner && (
          <div style={{ marginTop: 16 }}>
            {!showAddForm ? (
              <button className="btn btn--field btn--small" onClick={() => setShowAddForm(true)}>
                + Add team
              </button>
            ) : (
              <form onSubmit={handleAdd} className="team-add-form">
                <label className="field-label">Team name</label>
                <input
                  className="text-input"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Sunday Night Ballers"
                  required
                />
                <label className="field-label">Abbreviation (optional)</label>
                <input
                  className="text-input"
                  type="text"
                  value={form.abbreviation}
                  onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
                  placeholder="SNB"
                  maxLength={6}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--brass btn--small" type="submit" disabled={busy}>
                    Add team
                  </button>
                  <button
                    className="btn btn--ghost btn--small"
                    type="button"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
