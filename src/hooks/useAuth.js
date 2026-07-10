import { useEffect, useState } from 'react';
import { auth } from '../supabaseClient';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe;
    let cancelled = false;

    (async () => {
      const current = await auth.getCurrentUser();
      if (!cancelled) {
        setUser(current);
        setLoading(false);
      }
      unsubscribe = auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { user, loading };
}
