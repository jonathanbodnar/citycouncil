import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';

const InstagramCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing Instagram authorization...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorReason = searchParams.get('error_reason');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      // User declined or error occurred
      setStatus('error');
      setMessage(errorDescription || errorReason || 'Authorization failed');
      
      // Notify opener window
      if (window.opener) {
        window.opener.postMessage({
          type: 'INSTAGRAM_AUTH_ERROR',
          error: errorDescription || errorReason || error
        }, window.location.origin);
      }
      
      // Close window after showing error
      setTimeout(() => {
        window.close();
      }, 3000);
      
      return;
    }

    if (code) {
      // Success! Pass code to opener window
      setStatus('success');
      setMessage('Instagram authorized! Connecting your account...');
      
      if (window.opener) {
        window.opener.postMessage({
          type: 'INSTAGRAM_AUTH_SUCCESS',
          code: code
        }, window.location.origin);
        
        // Close popup after successful auth
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        // Fallback if opener is not available
        setMessage('Instagram authorized! Please close this window and return to the app.');
      }
      
      return;
    }

    // No code or error - something went wrong
    setStatus('error');
    setMessage('Invalid callback parameters');
    setTimeout(() => {
      window.close();
    }, 3000);
    
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4">
      <div className="glass-strong rounded-2xl p-8 max-w-md w-full border border-white/30 text-center">
        <Logo size="lg" theme="dark" />
        
        <div className="mt-6">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              <p className="text-white">{message}</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <svg className="w-16 h-16 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-white font-medium">{message}</p>
              <p className="text-sm text-gray-400">This window will close automatically...</p>
            </div>
          )}
          
          {status === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <svg className="w-16 h-16 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-white font-medium">Authorization Failed</p>
              <p className="text-sm text-gray-400">{message}</p>
              <p className="text-xs text-gray-500">This window will close automatically...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstagramCallbackPage;

