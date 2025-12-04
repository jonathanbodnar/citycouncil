import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, userType: 'user' | 'talent', phoneNumber?: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session?.user?.email);
      setSession(session);
      setSupabaseUser(session?.user ?? null);
      
      if (session?.user) {
        // Don't await here - call fetchUserProfile without blocking
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('Fetching user profile for:', userId);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('User profile not found, creating from auth data...');
        // If user profile doesn't exist, try to create it from auth user data
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          console.log('Creating user profile for:', authUser.email);
          
          // First check if user actually exists (might have been a race condition)
          const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (existingUser) {
            // User exists, just use it (don't overwrite user_type!)
            console.log('User already exists, using existing profile:', existingUser);
            setUser(existingUser);
          } else {
            // User doesn't exist, create new one
            const { data: createdUser, error: createError } = await supabase
              .from('users')
              .insert([
                {
                  id: authUser.id,
                  email: authUser.email || '',
                  full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
                  user_type: authUser.user_metadata?.user_type || 'user',
                },
              ])
              .select()
              .single();

            if (createError) {
              console.error('Error creating user profile:', createError);
              throw createError;
            }
            
            console.log('User profile created successfully:', createdUser);
            setUser(createdUser);
          }
        } else {
          throw error;
        }
      } else {
        console.log('User profile found:', data);
        setUser(data);
      }
    } catch (error) {
      console.error('Error fetching/creating user profile:', error);
      // Don't throw error, just set loading to false so UI doesn't hang
      setUser(null);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, userType: 'user' | 'talent', phoneNumber?: string) => {
    try {
      console.log('🔍 signUp called with:', { email, fullName, userType, phoneNumber });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            user_type: userType,
            phone_number: phoneNumber || null,
          },
          emailRedirectTo: undefined, // Disable email confirmation redirect
        },
      });

      if (error) throw error;

      // Auto-sign in the user if signup was successful (bypassing email confirmation)
      if (data.user && !error) {
        // Immediately sign in the user
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        // If sign in fails due to unconfirmed email, that's expected
        if (signInError && !signInError.message.includes('Email not confirmed')) {
          throw signInError;
        }
      }

      // Create user profile in our users table
      // Note: The database trigger (handle_new_user) automatically creates the user
      // but we'll use UPSERT here to ensure the data is correct and avoid race conditions
      if (data.user) {
        console.log('📱 Saving user with phone:', phoneNumber ? '(has phone)' : '(no phone)');
        
        const { error: profileError } = await supabase
          .from('users')
          .upsert([
            {
              id: data.user.id,
              email: data.user.email,
              full_name: fullName,
              user_type: userType,
              phone: phoneNumber || null, // Save phone number to database
            },
          ], {
            onConflict: 'id',
            ignoreDuplicates: false
          });

        if (profileError) {
          console.error('Error upserting user profile:', profileError);
          // Don't throw - the trigger may have already created it
        } else {
          console.log('✅ User profile saved successfully');
        }

        // Create additional profile based on user type
        if (userType === 'user') {
          // Use UPSERT for user_profiles too
          await supabase
            .from('user_profiles')
            .upsert([{ user_id: data.user.id }], {
              onConflict: 'user_id',
              ignoreDuplicates: true
            });
        } else if (userType === 'talent') {
          // We'll handle talent profile creation in the onboarding flow
        }
      }

      return data;
    } catch (error) {
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('SignIn function called with:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Auth signIn response:', { data, error });

      if (error) throw error;

      // Update last_login timestamp
      if (data.user) {
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.user.id);
      }

      // The auth state change listener will handle profile fetching
      return data;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Clear local state first
      setUser(null);
      setSupabaseUser(null);
      setSession(null);
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out from Supabase:', error);
        throw error;
      }
      
      console.log('✅ Successfully signed out');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return;

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;

    setUser({ ...user, ...updates });
  };

  const value = {
    user,
    supabaseUser,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
