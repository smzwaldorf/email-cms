import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User as AppUser, UserRole } from '../types';

interface AuthContextType {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  isAdmin: () => boolean;
  isTeacher: () => boolean;
  isParent: () => boolean;
  isStudent: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Maps Supabase User to our application User type
 */
function mapSupabaseUserToAppUser(supabaseUser: User | null, profile: any = null): AppUser | null {
  if (!supabaseUser) return null;

  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    role: (profile?.role as UserRole) || UserRole.PARENT, // Default to PARENT
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    displayName: profile?.display_name || supabaseUser.user_metadata?.display_name,
    avatar: profile?.avatar_url || supabaseUser.user_metadata?.avatar_url,
    phoneNumber: profile?.phone_number,
    isActive: profile?.is_active ?? true,
    emailVerified: supabaseUser.email_confirmed_at !== null,
    lastLoginAt: supabaseUser.last_sign_in_at || undefined,
    createdAt: supabaseUser.created_at,
    updatedAt: profile?.updated_at || supabaseUser.updated_at || new Date().toISOString(),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch user profile from public.profiles table
   */
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  }, []);

  /**
   * Update auth state when session changes
   */
  const updateAuthState = useCallback(async (session: Session | null) => {
    setSession(session);

    if (session?.user) {
      const profile = await fetchUserProfile(session.user.id);
      const appUser = mapSupabaseUserToAppUser(session.user, profile);
      setUser(appUser);
    } else {
      setUser(null);
    }

    setLoading(false);
  }, [fetchUserProfile]);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthState(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateAuthState(session);
    });

    return () => subscription.unsubscribe();
  }, [updateAuthState]);

  /**
   * Sign in with Google OAuth
   */
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  /**
   * Sign in with email magic link
   */
  const signInWithEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error sending magic link:', error);
      throw error;
    }
  };

  /**
   * Sign out
   */
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  /**
   * Check if user has specific role
   */
  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  /**
   * Check if user is admin
   */
  const isAdmin = (): boolean => {
    return hasRole(UserRole.ADMIN);
  };

  /**
   * Check if user is teacher
   */
  const isTeacher = (): boolean => {
    return hasRole(UserRole.CLASS_TEACHER);
  };

  /**
   * Check if user is parent
   */
  const isParent = (): boolean => {
    return hasRole(UserRole.PARENT);
  };

  /**
   * Check if user is student
   */
  const isStudent = (): boolean => {
    return hasRole(UserRole.STUDENT);
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signOut,
    isAuthenticated: !!user,
    hasRole,
    isAdmin,
    isTeacher,
    isParent,
    isStudent,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to access auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
