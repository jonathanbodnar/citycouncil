import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { logger } from '../utils/logger';

const ShortLinkRedirectPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code) {
      handleRedirect();
    }
  }, [code]);

  const handleRedirect = async () => {
    try {
      logger.log('🔗 Short link redirect:', code);

      // Track click and get target URL
      const { data, error } = await supabase.rpc('track_short_link_click', {
        p_short_code: code,
        p_metadata: {
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          referrer: document.referrer || 'direct'
        }
      });

      if (error) throw error;

      if (data) {
        logger.log('✅ Redirecting to:', data.substring(0, 50) + '...');
        // Redirect to the full URL
        window.location.href = data;
      } else {
        throw new Error('Short link not found');
      }
    } catch (error: any) {
      logger.error('Error resolving short link:', error);
      setError(error.message || 'Link not found or expired');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Not Found</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Redirecting...</h2>
        <p className="text-gray-600">Please wait while we redirect you</p>
      </div>
    </div>
  );
};

export default ShortLinkRedirectPage;

