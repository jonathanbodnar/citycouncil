import React, { useState } from 'react';
import { Link, Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabase';
import MFAVerification from '../components/MFAVerification';

const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get('returnTo') || '/home';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const { user, signIn } = useAuth();

  // Handle redirect after successful login
  React.useEffect(() => {
    const handleRedirect = async () => {
      console.log('LoginPage useEffect triggered:', { 
        hasUser: !!user, 
        showMFAVerification,
        userId: user?.id,
        userType: user?.user_type 
      });
      
      // CRITICAL: Must have both user AND user.id (user object fully populated)
      if (user && user.id && !showMFAVerification) {
        console.log('LoginPage: REDIRECT LOGIC RUNNING');
        console.log('LoginPage: User object:', user);
        console.log('LoginPage: User ID:', user.id);
        console.log('LoginPage: User type from context:', user.user_type);
        
        // Check if there's a fulfillment token to redirect to
        const fulfillmentToken = sessionStorage.getItem('fulfillment_redirect_token');
        console.log('LoginPage: Fulfillment token:', fulfillmentToken);
        
        if (fulfillmentToken) {
          console.log('LoginPage: Found fulfillment token, redirecting to /fulfill/', fulfillmentToken);
          sessionStorage.removeItem('fulfillment_redirect_token');
          navigate(`/fulfill/${fulfillmentToken}`, { replace: true });
          return;
        }
        
        // Double-check user type from database
        try {
          const { data: userData, error } = await supabase
            .from('users')
            .select('user_type')
            .eq('id', user.id)
            .single();
          
          console.log('LoginPage: Database user type:', userData?.user_type);
          
          if (!error && userData?.user_type === 'talent') {
            console.log('LoginPage: ✅ Talent user confirmed, CALLING navigate(/dashboard)');
            navigate('/dashboard', { replace: true });
            console.log('LoginPage: ✅ navigate() called');
          } else if (user.user_type === 'talent') {
            console.log('LoginPage: ✅ Talent user from context, CALLING navigate(/dashboard)');
            navigate('/dashboard', { replace: true });
            console.log('LoginPage: ✅ navigate() called');
          } else {
            console.log('LoginPage: Regular user, redirecting to:', returnTo);
            navigate(returnTo, { replace: true });
          }
        } catch (err) {
          console.error('LoginPage: Error checking user type:', err);
          // Fallback to context user_type
          if (user.user_type === 'talent') {
            console.log('LoginPage: ✅ Fallback - Talent user, CALLING navigate(/dashboard)');
            navigate('/dashboard', { replace: true });
            console.log('LoginPage: ✅ navigate() called');
          } else {
            navigate(returnTo, { replace: true });
          }
        }
      }
    };
    
    handleRedirect();
  }, [user, showMFAVerification, navigate, returnTo]);

  // Don't render the form if user is already logged in
  if (user && !showMFAVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Add a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setLoading(false);
      toast.error('Login is taking too long. Please try again.');
    }, 10000); // 10 second timeout

    try {
      console.log('Attempting to sign in with:', email);
      const result = await signIn(email, password);
      console.log('Sign in result:', result);
      clearTimeout(timeout);

      // Check if MFA is required
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      console.log('AAL Check:', { aal, aalError });
      
      if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
        console.log('MFA is required - fetching factors...');
        // MFA is required - get the factor ID
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        console.log('Factors:', { factors, factorsError });
        
        // Check for any verified factor (TOTP or Phone)
        let factorId: string | null = null;
        
        if (factors?.totp && factors.totp.length > 0) {
          const verifiedTotp = factors.totp.find((f: any) => f.status === 'verified');
          if (verifiedTotp) {
            factorId = verifiedTotp.id;
            console.log('Found verified TOTP factor:', factorId);
          }
        }
        
        if (!factorId && factors?.phone && factors.phone.length > 0) {
          const verifiedPhone = factors.phone.find((f: any) => f.status === 'verified');
          if (verifiedPhone) {
            factorId = verifiedPhone.id;
            console.log('Found verified Phone factor:', factorId);
          }
        }
        
        if (factorId) {
          // For phone factors, we need to send the challenge (SMS) first
          const isPhoneFactor = factors?.phone?.some((f: any) => f.id === factorId);
          
          if (isPhoneFactor) {
            console.log('Sending SMS challenge...');
            const { error: challengeError } = await supabase.auth.mfa.challenge({
              factorId: factorId
            });
            
            if (challengeError) {
              console.error('Challenge error:', challengeError);
              toast.error('Failed to send verification code');
              setLoading(false);
              return;
            }
            
            toast.success('Verification code sent to your phone!');
          }
          
          setMfaFactorId(factorId);
          setShowMFAVerification(true);
          setLoading(false);
          return;
        } else {
          console.warn('MFA required but no verified factors found');
        }
      } else {
        console.log('MFA not required - current level:', aal?.currentLevel, 'next level:', aal?.nextLevel);
      }

      toast.success('Welcome back! Redirecting...');
      // Navigate to returnTo URL after successful login
      setTimeout(() => {
        navigate(returnTo);
      }, 1000);
    } catch (error: any) {
      console.error('Sign in error:', error);
      clearTimeout(timeout);
      toast.error(error.message || 'Failed to sign in');
      setLoading(false); // Make sure to stop loading on error
    }
  };

  const handleMFASuccess = () => {
    console.log('LoginPage: MFA verification successful, clearing MFA state');
    setShowMFAVerification(false);
    toast.success('Welcome back!');
    // Let the useEffect handle the redirect based on user type
  };

  const handleMFACancel = () => {
    setShowMFAVerification(false);
    setMfaFactorId('');
    // Sign out the partially authenticated session
    supabase.auth.signOut();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);

    try {
      const redirectUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5173/reset-password'
        : 'https://shoutout.us/reset-password';

      console.log('Sending password reset to:', resetEmail);
      console.log('Redirect URL:', redirectUrl);

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout - email service may be unavailable')), 10000)
      );

      const resetPromise = supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectUrl,
      });

      const { data, error } = await Promise.race([resetPromise, timeoutPromise]) as any;

      console.log('Reset password response:', { data, error });

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      // Supabase will send email even if account doesn't exist (for security)
      // but won't throw an error
      toast.success('If an account exists with this email, you will receive a password reset link. Check your inbox (and spam folder).');
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      console.error('Password reset error:', error);
      if (error.message?.includes('timeout')) {
        toast.error('Email service is currently unavailable. Please try again later or contact support.');
      } else if (error.message?.includes('redirect')) {
        toast.error('Configuration error. Please contact support.');
      } else {
        toast.error(error.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  // Show MFA verification if required
  if (showMFAVerification && mfaFactorId) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <MFAVerification
          factorId={mfaFactorId}
          onSuccess={handleMFASuccess}
          onCancel={handleMFACancel}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link to="/" className="flex justify-center">
            <Logo size="lg" theme="dark" />
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            Or{' '}
            <Link
              to={`/signup${returnTo !== '/home' ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
              className="font-medium text-blue-400 hover:text-blue-300"
            >
              create a new account
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <button 
                type="button" 
                onClick={() => setShowForgotPassword(true)}
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Forgot your password?
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-2xl p-8 max-w-md w-full border border-white/30 shadow-modern-xl">
            <h3 className="text-2xl font-bold text-white mb-2">Reset Password</h3>
            <p className="text-gray-300 mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            
            <form onSubmit={handleForgotPassword}>
              <div className="mb-4">
                <label htmlFor="reset-email" className="block text-sm font-medium text-white mb-2">
                  Email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-4 py-3 glass-strong border border-white/30 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail('');
                  }}
                  className="flex-1 px-4 py-3 glass border border-white/30 rounded-xl text-white font-medium hover:glass-strong transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-modern"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
