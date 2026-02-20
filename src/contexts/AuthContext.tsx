import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { signInWithGoogle, signInWithApple, signOut as authSignOut } from '../lib/auth';
import type { Profile } from '../types/database';

// ── Types ───────────────────────────────────────────────────

interface AuthState {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True when user has signed in but hasn't set display_name or home_currency yet */
  needsOnboarding: boolean;
}

interface AuthActions {
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: { display_name?: string; home_currency?: string }) => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

// ── Context ─────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // Profile might not exist yet if trigger hasn't fired
      setProfile(null);
      return null;
    }

    setProfile(data as Profile);
    return data as Profile;
  }, []);

  useEffect(() => {
    // Fetch the initial session
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession?.user) {
        await fetchProfile(initialSession.user.id);
      }
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, updatedSession) => {
        setSession(updatedSession);
        if (updatedSession?.user) {
          await fetchProfile(updatedSession.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  const updateProfile = useCallback(async (updates: { display_name?: string; home_currency?: string }) => {
    if (!session?.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id);

    if (error) throw error;
    await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
    setProfile(null);
  }, []);

  const needsOnboarding = !!session?.user && !!profile && (
    !profile.display_name || profile.display_name === '' ||
    !profile.home_currency || profile.home_currency === ''
  );

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    isLoading,
    isAuthenticated: !!session?.user,
    needsOnboarding,
    signInWithGoogle,
    signInWithApple,
    signOut: handleSignOut,
    refreshProfile,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
