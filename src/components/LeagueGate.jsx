import { useEffect, useState } from 'react';
import { db } from '../supabaseClient';

export default function LeagueGate({ onSelect }) {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [joinDisplayName, setJoinDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const data = await db.leagues.list();
      setLeagues(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newLeagueName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const league = await db.leagues.create({
        name: newLeagueName.trim(),
        displayName: createDisplayName.trim() || null,
      });
      onSelect(league);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!joinId.trim()) return;
    setBusy(true);
    setError('');
    try {
      await db.leagues.joinById(joinId.trim(), joinDisplayName.trim() || null);
      const league = await db.leagues.get(joinId.trim());
      onSelect(league);
    } catch (err) {
      setError('Could not join that league — double-check the League ID with your commissioner.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="centered-screen">
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <h1>Your leagues</h1>
        <p>Pick a league to enter, or set one up.</p>

        {loading ? (
          <p className="loading-text">Loading…</p>
        ) : leagues.length > 0 ? (
          <div className="league-list">
            {leagues.map((league) => (
              <div className="league-list__item" key={league.id}>
                <span className="league-list__name">{league.name}</span>
                <button className="btn btn--ghost btn--small" onClick={() => onSelect(league)}>
                  Enter
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="auth-status">You're not in a league yet.</p>
        )}

        <div className="divider-word">Start a league</div>
        <p className="gate-help-text">
          Setting up a new dynasty? Create it here — you'll be the commissioner,
          able to add teams and run the weekly check-in.
        </p>
        <form onSubmit={handleCreate}>
          <label className="field-label" htmlFor="league-name">
            League name
          </label>
          <input
            id="league-name"
            className="text-input"
            type="text"
            placeholder="Sunday Night Dynasty"
            value={newLeagueName}
            onChange={(e) => setNewLeagueName(e.target.value)}
            disabled={busy}
          />
          <label className="field-label" htmlFor="create-display-name">
            Your name (optional)
          </label>
          <input
            id="create-display-name"
            className="text-input"
            type="text"
            placeholder="Trevor"
            value={createDisplayName}
            onChange={(e) => setCreateDisplayName(e.target.value)}
            disabled={busy}
          />
          <button className="btn btn--field" type="submit" disabled={busy} style={{ width: '100%' }}>
            Create league
          </button>
        </form>

        <div className="divider-word">Join with a League ID</div>
        <p className="gate-help-text">
          Already in a dynasty someone else set up? Ask them for the League ID
          and join as a player.
        </p>
        <form onSubmit={handleJoin}>
          <label className="field-label" htmlFor="league-id">
            League ID (ask your commissioner)
          </label>
          <input
            id="league-id"
            className="text-input"
            type="text"
            placeholder="00000000-0000-0000-0000-000000000000"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            disabled={busy}
          />
          <label className="field-label" htmlFor="join-display-name">
            Your name (optional)
          </label>
          <input
            id="join-display-name"
            className="text-input"
            type="text"
            placeholder="Trevor"
            value={joinDisplayName}
            onChange={(e) => setJoinDisplayName(e.target.value)}
            disabled={busy}
          />
          <button className="btn btn--ghost" type="submit" disabled={busy} style={{ width: '100%' }}>
            Join league
          </button>
        </form>

        {error && <p className="auth-status auth-status--error">{error}</p>}
      </div>
    </div>
  );
}
