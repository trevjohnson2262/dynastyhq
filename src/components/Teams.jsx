import { useState, useMemo } from 'react';
import { db } from '../supabaseClient';
import cfbSchools from '../../data/cfb_schools.json';

const SCHOOLS_BY_CONFERENCE = (() => {
  const groups = new Map();
  [...cfbSchools]
    .sort((a, b) => a.school.localeCompare(b.school))
    .forEach((s) => {
      if (!groups.has(s.conference)) groups.set(s.conference, []);
      groups.get(s.conference).push(s);
    });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
})();

const SCHOOL_LOOKUP = new Map(cfbSchools.map((s) => [s.school, s]));

export default function Teams({ league, teams, currentUser, myTeam, isCommissioner }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ school: '', abbreviation: '' });

  const usedSchools = useMemo(() => new Set(teams.map((t) => t.school).filter(Boolean)), [teams]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.school) return;
    const picked = SCHOOL_LOOKUP.get(form.school);
    if (!picked) return;
    setBusy(true);
    setError('');
    try {
      await db.teams.create({
        league_id: league.id,
        school: picked.school,
        name: `${picked.school} ${picked.nickname}`,
        abbreviation: form.abbreviation.trim() || null,
      });
      setForm({ school: '', abbreviation: '' });
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
        {!myTeam && teams.some((t) => !t.owner_id) && (
          <p className="team-claim-nudge">
            Pick your team below to get started — click "Claim this team" next
            to the school you're playing as.
          </p>
        )}
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
                  {team.school && SCHOOL_LOOKUP.get(team.school) && (
                    <span className="team-roster__conference">
                      {SCHOOL_LOOKUP.get(team.school).conference}
                    </span>
                  )}
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
                <label className="field-label">School</label>
                <select
                  className="roster-select"
                  value={form.school}
                  onChange={(e) => setForm({ ...form, school: e.target.value })}
                  required
                >
                  <option value="">Select a school</option>
                  {SCHOOLS_BY_CONFERENCE.map(([conference, schools]) => (
                    <optgroup key={conference} label={conference}>
                      {schools.map((s) => (
                        <option key={s.school} value={s.school} disabled={usedSchools.has(s.school)}>
                          {s.school} {s.nickname}
                          {usedSchools.has(s.school) ? ' (taken)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
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
