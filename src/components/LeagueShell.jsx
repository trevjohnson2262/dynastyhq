import { useState } from 'react';
import { auth, db } from '../supabaseClient';

export default function LeagueShell({ league, isCommissioner, onLeagueUpdate, onLeaveLeague, children }) {
  const [busy, setBusy] = useState(false);

  async function handleStartNewSeason() {
    const confirmed = window.confirm(
      `Start Season ${league.season + 1}? This resets the week counter back to 1.`
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const updated = await db.leagues.startNewSeason(league.id, league.season);
      onLeagueUpdate(updated);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="scoreboard-header">
        <div>
          <div className="scoreboard-header__league">{league.name}</div>
          <div className="scoreboard-header__meta">
            <span>Season {league.season}</span>
            <span>·</span>
            <span>
              Week <span className="scoreboard-header__week">{league.current_week}</span>
            </span>
          </div>
        </div>
        <div className="scoreboard-header__actions">
          {isCommissioner && (
            <button className="btn btn--ghost btn--small" onClick={handleStartNewSeason} disabled={busy}>
              Start new season
            </button>
          )}
          <button className="btn btn--ghost btn--small" onClick={onLeaveLeague}>
            Switch league
          </button>
          <button className="btn btn--ghost btn--small" onClick={() => auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
