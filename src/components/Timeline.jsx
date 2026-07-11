import { useState, useEffect, useCallback } from 'react';
import { db, realtime } from '../supabaseClient';

const EVENT_TYPES = [
  'General',
  'Trade',
  'Injury',
  'Milestone',
  'Coaching Change',
  'Playoff/Bowl',
];

export default function Timeline({ league, isCommissioner }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    week: league.current_week,
    event_type: 'General',
    description: '',
  });

  const load = useCallback(async () => {
    try {
      const data = await db.timelineEvents.list(league.id);
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, [league.id]);

  useEffect(() => {
    setLoading(true);
    load();
    const unsubscribe = realtime.subscribeToTimeline(league.id, () => load());
    return unsubscribe;
  }, [load, league.id]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    setBusy(true);
    setError('');
    try {
      await db.timelineEvents.create({
        league_id: league.id,
        week: form.week ? Number(form.week) : null,
        event_type: form.event_type,
        description: form.description.trim(),
      });
      setForm({ week: league.current_week, event_type: 'General', description: '' });
      setShowAddForm(false);
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
      await db.timelineEvents.remove(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel--schedule panel--full-width">
      <div className="panel__header">
        <h2 className="panel__title">Timeline</h2>
        <span className="panel__subtitle">{events.length} events</span>
      </div>
      <div className="panel__body">
        {loading ? (
          <p className="loading-text" style={{ color: '#6b6350' }}>
            Loading timeline…
          </p>
        ) : events.length === 0 ? (
          <p className="schedule-empty">
            No events logged yet{isCommissioner ? ' — add the first one below.' : '.'}
          </p>
        ) : (
          <div className="timeline-list">
            {events.map((ev) => (
              <div className="timeline-event" key={ev.id}>
                <div className="timeline-event__marker">
                  {ev.week ? `Wk ${ev.week}` : '—'}
                </div>
                <div className="timeline-event__body">
                  <span className="timeline-event__type">{ev.event_type || 'General'}</span>
                  <p className="timeline-event__description">{ev.description}</p>
                </div>
                {isCommissioner && (
                  <button
                    className="btn btn--ghost btn--small"
                    onClick={() => handleRemove(ev.id)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="auth-status auth-status--error">{error}</p>}

        {isCommissioner && (
          <div style={{ marginTop: 16 }}>
            {!showAddForm ? (
              <button className="btn btn--field btn--small" onClick={() => setShowAddForm(true)}>
                + Add event
              </button>
            ) : (
              <form onSubmit={handleAdd} className="recruit-add-form">
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
                  />
                </div>
                <div>
                  <label className="field-label" style={{ color: '#6b6350' }}>
                    Type
                  </label>
                  <select
                    className="roster-select schedule-input"
                    value={form.event_type}
                    onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" style={{ color: '#6b6350' }}>
                    Description
                  </label>
                  <input
                    className="text-input schedule-input"
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Traded Jamie Prospect to The Testers"
                    required
                  />
                </div>
                <button className="btn btn--field btn--small" type="submit" disabled={busy}>
                  Add event
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
