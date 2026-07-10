import { auth } from '../supabaseClient';

export default function LeagueShell({ league, onLeaveLeague, children }) {
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
