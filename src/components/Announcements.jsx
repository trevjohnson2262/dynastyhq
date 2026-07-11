import { useState, useEffect, useCallback } from 'react';
import { db, realtime } from '../supabaseClient';

export default function Announcements({ league, currentUser, isCommissioner }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });

  const load = useCallback(async () => {
    try {
      const data = await db.announcements.list(league.id);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [league.id]);

  useEffect(() => {
    setLoading(true);
    load();
    const unsubscribe = realtime.subscribeToAnnouncements(league.id, () => load());
    return unsubscribe;
  }, [load, league.id]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await db.announcements.create({
        league_id: league.id,
        title: form.title.trim(),
        body: form.body.trim() || null,
        created_by: currentUser.id,
      });
      setForm({ title: '', body: '' });
      setShowAddForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePin(item) {
    setBusy(true);
    setError('');
    try {
      await db.announcements.setPinned(item.id, !item.pinned);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id) {
    setBusy(true);
    setError('');
    try {
      await db.announcements.remove(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel--tracker panel--full-width">
      <div className="panel__header">
        <h2 className="panel__title">Announcements</h2>
        <span className="panel__subtitle">{items.length} posted</span>
      </div>
      <div className="panel__body">
        {loading ? (
          <p className="loading-text">Loading announcements…</p>
        ) : items.length === 0 ? (
          <p className="loading-text">
            No announcements yet{isCommissioner ? ' — post the first one below.' : '.'}
          </p>
        ) : (
          <div className="news-list">
            {items.map((item) => (
              <article
                className={`news-item ${item.pinned ? 'news-item--pinned' : ''}`}
                key={item.id}
              >
                <div className="news-item__header">
                  <span className="news-item__title">
                    {item.pinned && <span className="news-item__pin-flag">PINNED</span>}
                    {item.title}
                  </span>
                </div>
                {item.body && <p className="news-item__body">{item.body}</p>}
                {isCommissioner && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn--ghost btn--small"
                      onClick={() => handleTogglePin(item)}
                      disabled={busy}
                    >
                      {item.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      className="btn btn--ghost btn--small"
                      onClick={() => handleRemove(item.id)}
                      disabled={busy}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {error && <p className="auth-status auth-status--error">{error}</p>}

        {isCommissioner && (
          <div style={{ marginTop: 16 }}>
            {!showAddForm ? (
              <button className="btn btn--field btn--small" onClick={() => setShowAddForm(true)}>
                + Post announcement
              </button>
            ) : (
              <form onSubmit={handleAdd} className="team-add-form">
                <label className="field-label">Title</label>
                <input
                  className="text-input"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Rosters lock Friday at 8pm"
                  required
                />
                <label className="field-label">Body (optional)</label>
                <textarea
                  className="text-input"
                  rows={3}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Details for the league…"
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--brass btn--small" type="submit" disabled={busy}>
                    Post
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
