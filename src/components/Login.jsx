import { useState } from 'react';
import { auth } from '../supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrorMsg('');
    try {
      await auth.signInWithMagicLink(email.trim());
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Something went wrong sending the link.');
    }
  }

  return (
    <div className="centered-screen">
      <div className="auth-card">
        <h1>DynastyHQ</h1>
        <p>Sign in to check in on your league, stamp your team ready, and see the roster.</p>

        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className="text-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'sending' || status === 'sent'}
            required
          />
          <button
            className="btn btn--brass"
            type="submit"
            disabled={status === 'sending' || status === 'sent'}
            style={{ width: '100%' }}
          >
            {status === 'sending' ? 'Sending link…' : 'Send magic link'}
          </button>
        </form>

        {status === 'sent' && (
          <p className="auth-status">
            Check your inbox for a sign-in link. It'll bring you right back here, signed in.
          </p>
        )}
        {status === 'error' && <p className="auth-status auth-status--error">{errorMsg}</p>}
      </div>
    </div>
  );
}
