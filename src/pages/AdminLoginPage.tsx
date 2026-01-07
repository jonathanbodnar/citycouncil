import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabase';
import MFAVerification from '../components/MFAVerification';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMFAVerification, setShowMFAVerification] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const { user, signIn } = useAuth();

  // Handle redirect after successful login
  useEffect(() => {
    const handleRedirect = async () => {
      if (user && user.id && !showMFAVerification) {
        // Check if user is admin
        const { data: userData } = await supabase
          .from('users')
          .select('user_type')
          .eq('id', user.id)
          .single();
        
        if (userData?.user_type === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          // Not an admin - sign out and show error
          await supabase.auth.signOut();
          toast.error('Access denied. Admin credentials required.');
        }
      }
    };
    
    handleRedirect();
  }, [user, showMFAVerification, navigate]);

  // Don't render the form if user is already logged in
  if (user && !showMFAVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const timeout = setTimeout(() => {
      setLoading(false);
      toast.error('Login is taking too long. Please try again.');
    }, 10000);

    try {
      await signIn(email, password);
      clearTimeout(timeout);

      // Check if MFA is required
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        
        let factorId: string | null = null;
        
        if (factors?.totp && factors.totp.length > 0) {
          const verifiedTotp = factors.totp.find((f: any) => f.status === 'verified');
          if (verifiedTotp) factorId = verifiedTotp.id;
        }
        
        if (!factorId && factors?.phone && factors.phone.length > 0) {
          const verifiedPhone = factors.phone.find((f: any) => f.status === 'verified');
          if (verifiedPhone) {
            factorId = verifiedPhone.id;
            await supabase.auth.mfa.challenge({ factorId });
            toast.success('Verification code sent to your phone!');
          }
        }
        
        if (factorId) {
          setMfaFactorId(factorId);
          setShowMFAVerification(true);
          setLoading(false);
          return;
        }
      }

      // Verify user is admin before allowing access
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: userData } = await supabase
          .from('users')
          .select('user_type')
          .eq('id', authUser.id)
          .single();
        
        if (userData?.user_type !== 'admin') {
          await supabase.auth.signOut();
          toast.error('Access denied. Admin credentials required.');
          setLoading(false);
          return;
        }
      }

      toast.success('Welcome back, Admin!');
    } catch (error: any) {
      clearTimeout(timeout);
      toast.error(error.message || 'Failed to sign in');
      setLoading(false);
    }
  };

  const handleMFASuccess = async () => {
    setShowMFAVerification(false);
    
    // Verify admin after MFA
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: userData } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', authUser.id)
        .single();
      
      if (userData?.user_type !== 'admin') {
        await supabase.auth.signOut();
        toast.error('Access denied. Admin credentials required.');
        return;
      }
    }
    
    toast.success('Welcome back, Admin!');
  };

  const handleMFACancel = () => {
    setShowMFAVerification(false);
    setMfaFactorId('');
    supabase.auth.signOut();
  };

  // Show MFA verification if required
  if (showMFAVerification && mfaFactorId) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-900">
        <MFAVerification
          factorId={mfaFactorId}
          onSuccess={handleMFASuccess}
          onCancel={handleMFACancel}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-900">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link to="/" className="flex justify-center">
            <Logo size="lg" theme="dark" />
          </Link>
          <div className="mt-6 flex items-center justify-center gap-2">
            <ShieldCheckIcon className="h-6 w-6 text-red-500" />
            <h2 className="text-center text-2xl font-bold text-white">
              Admin Login
            </h2>
          </div>
          <p className="mt-2 text-center text-sm text-gray-400">
            Authorized personnel only
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
                className="appearance-none rounded-none relative block w-full px-4 py-3 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-t-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent focus:z-10 sm:text-sm"
                placeholder="Admin email"
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
                className="appearance-none rounded-none relative block w-full px-4 py-3 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-b-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ShieldCheckIcon className="h-5 w-5 mr-2" />
            {loading ? 'Authenticating...' : 'Access Admin Panel'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          Not an admin?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            Regular login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;

