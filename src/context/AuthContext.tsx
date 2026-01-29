import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, userType: 'user' | 'talent', phoneNumber?: string, promoSource?: string | null) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<{ success: boolean; error?: string; phoneHint?: string; rateLimited?: boolean }>;
  verifyPhoneOtp: (phone: string, code: string) => Promise<{ success: boolean; error?: string; magicLink?: string; user?: any }>;
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
    console.log('🟢 AuthContext: Getting initial session...');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('🟢 Initial session result:', { 
        hasSession: !!session, 
        hasUser: !!session?.user, 
        email: session?.user?.email,
        error 
      });
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
      console.log('🔵 Auth state change:', event, session?.user?.email);
      console.log('🔵 Stack trace:', new Error().stack);
      console.log('🔵 Session exists:', !!session);
      console.log('🔵 User exists:', !!session?.user);
      
      setSession(session);
      setSupabaseUser(session?.user ?? null);
      
      if (session?.user) {
        // Don't await here - call fetchUserProfile without blocking
        fetchUserProfile(session.user.id);
      } else {
        console.log('⚠️ No session - setting user to null');
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
        console.log('User profile fetch error:', error.code, error.message);
        
        // If it's just "no rows returned" (PGRST116), try to create the profile
        // If it's an RLS error (42501) or other permission error, create a minimal user object
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser) {
          console.log('Auth user found, attempting to create/fetch profile for:', authUser.email);
          
          // First check if user actually exists (might have been a race condition or RLS blocking initial read)
          const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

          if (existingUser) {
            // User exists, just use it (don't overwrite user_type, phone, promo_source!)
            console.log('User already exists, using existing profile:', existingUser);
            setUser(existingUser);
          } else if (checkError?.code === 'PGRST116') {
            // User truly doesn't exist, try to create
            // IMPORTANT: Preserve phone and promo_source from auth metadata if available
            console.log('User does not exist, creating new profile...');
            const { data: createdUser, error: createError } = await supabase
              .from('users')
              .insert([
                {
                  id: authUser.id,
                  email: authUser.email || '',
                  full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
                  user_type: authUser.user_metadata?.user_type || 'user',
                  phone: authUser.user_metadata?.phone || authUser.phone || null,
                  promo_source: authUser.user_metadata?.promo_source || null,
                },
              ])
              .select()
              .single();

            if (createError) {
              console.error('Error creating user profile:', createError);
              // FALLBACK: Create a minimal user object from auth data so user isn't logged out
              // IMPORTANT: Preserve phone and promo_source from metadata
              console.log('Using fallback user object from auth data');
              setUser({
                id: authUser.id,
                email: authUser.email || '',
                full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
                user_type: authUser.user_metadata?.user_type || 'user',
                avatar_url: authUser.user_metadata?.avatar_url || null,
                phone: authUser.user_metadata?.phone || authUser.phone || null,
                promo_source: authUser.user_metadata?.promo_source || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as User);
            } else {
              console.log('User profile created successfully:', createdUser);
              setUser(createdUser);
            }
          } else {
            // Some other error (likely RLS) - use fallback user object
            // IMPORTANT: Preserve phone and promo_source from metadata
            console.log('RLS or other error, using fallback user object. Error:', checkError);
            setUser({
              id: authUser.id,
              email: authUser.email || '',
              full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
              user_type: authUser.user_metadata?.user_type || 'user',
              avatar_url: authUser.user_metadata?.avatar_url || null,
              phone: authUser.user_metadata?.phone || authUser.phone || null,
              promo_source: authUser.user_metadata?.promo_source || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as User);
          }
        } else {
          // No auth user - this is a real logout scenario
          console.log('No auth user found, setting user to null');
          setUser(null);
        }
      } else {
        console.log('User profile found:', data);
        setUser(data);
      }
    } catch (error) {
      console.error('Error fetching/creating user profile:', error);
      // FALLBACK: Try to get auth user and create minimal profile
      // IMPORTANT: Preserve phone and promo_source from metadata
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          console.log('Exception caught but auth user exists, using fallback');
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
            user_type: authUser.user_metadata?.user_type || 'user',
            avatar_url: authUser.user_metadata?.avatar_url || null,
            phone: authUser.user_metadata?.phone || authUser.phone || null,
            promo_source: authUser.user_metadata?.promo_source || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as User);
        } else {
          setUser(null);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        setUser(null);
      }
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, userType: 'user' | 'talent', phoneNumber?: string, promoSource?: string | null) => {
    try {
      console.log('🔍 signUp called with:', { email, fullName, userType, phoneNumber, promoSource });
      
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
        
        // Check if user did the holiday popup (stored in localStorage)
        let didHolidayPopup = false;
        try {
          didHolidayPopup = localStorage.getItem('holiday_popup_submitted') === 'true';
        } catch {
          // localStorage not available
        }
        
        const { error: profileError } = await supabase
          .from('users')
          .upsert([
            {
              id: data.user.id,
              email: data.user.email,
              full_name: fullName,
              user_type: userType,
              phone: phoneNumber || null, // Save phone number to database
              promo_source: promoSource || null, // Track UTM source for analytics
              did_holiday_popup: didHolidayPopup, // Track if they submitted the holiday popup
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
            
          // Note: Tracking events (Meta Pixel, Rumble) are fired in SignupPage.tsx
          // to ensure they fire on the click/submit action (like the popup does for Lead)
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
      console.log('🟡 SignIn function called with:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('🟡 Auth signIn response:', { 
        hasData: !!data, 
        hasUser: !!data?.user, 
        hasSession: !!data?.session,
        email: data?.user?.email,
        error 
      });

      if (error) throw error;

      // Update last_login timestamp
      if (data.user) {
        console.log('🟡 Updating last_login for:', data.user.email);
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', data.user.id);
      }

      console.log('🟡 SignIn completed successfully');
      // The auth state change listener will handle profile fetching
      return data;
    } catch (error) {
      console.error('🔴 SignIn error:', error);
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

  // Send OTP code to phone number for login
  const sendPhoneOtp = async (phone: string): Promise<{ success: boolean; error?: string; phoneHint?: string; rateLimited?: boolean }> => {
    try {
      console.log('Sending OTP to phone:', phone);
      
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-login-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ phone }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to send verification code',
          rateLimited: data.rateLimited,
        };
      }

      return {
        success: true,
        phoneHint: data.phoneHint,
      };
    } catch (error: any) {
      console.error('Error sending phone OTP:', error);
      return {
        success: false,
        error: error.message || 'Failed to send verification code',
      };
    }
  };

  // Verify OTP code and log in
  const verifyPhoneOtp = async (phone: string, code: string): Promise<{ success: boolean; error?: string; magicLink?: string; user?: any }> => {
    try {
      console.log('Verifying OTP for phone:', phone);
      
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      
      // Pass current site URL so magic link redirects back to the correct environment
      const currentSiteUrl = window.location.origin;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/verify-login-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ phone, code, siteUrl: currentSiteUrl }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to verify code',
        };
      }

      // If we got session tokens directly, set the session
      if (data.session?.access_token && data.session?.refresh_token) {
        console.log('Setting session from OTP verification');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        
        if (sessionError) {
          console.error('Error setting session:', sessionError);
          // Fall back to magic link if available
          if (data.magicLink) {
            return {
              success: true,
              magicLink: data.magicLink,
              user: data.user,
            };
          }
          return {
            success: false,
            error: 'Failed to establish session',
          };
        }
        
        // Session set successfully - no redirect needed!
        return {
          success: true,
          user: data.user,
        };
      }

      // Fall back to magic link if no session tokens
      if (data.magicLink) {
        return {
          success: true,
          magicLink: data.magicLink,
          user: data.user,
        };
      }

      return {
        success: false,
        error: 'Authentication failed',
      };
    } catch (error: any) {
      console.error('Error verifying phone OTP:', error);
      return {
        success: false,
        error: error.message || 'Failed to verify code',
      };
    }
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
    sendPhoneOtp,
    verifyPhoneOtp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
