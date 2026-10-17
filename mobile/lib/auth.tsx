import type { Session } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

type Profile = Pick<Tables<'profiles'>, 'id' | 'username' | 'bio' | 'avatar_path' | 'id_verified_at'>;

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  // True until the stored session and, when signed in, the profile have been loaded.
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, profile: null, loading: true });

export const profileQueryKey = (userId: string | undefined) => ['profile', userId] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const profileQuery = useQuery({
    queryKey: profileQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, bio, avatar_path, id_verified_at')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const loading = !sessionLoaded || (!!userId && profileQuery.isPending);

  return (
    <AuthContext.Provider value={{ session, profile: profileQuery.data ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
