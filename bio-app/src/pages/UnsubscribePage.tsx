import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';

const UnsubscribePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading');
  const [talentName, setTalentName] = useState<string>('');

  useEffect(() => {
    const processUnsubscribe = async () => {
      if (!token) {
        setStatus('error');
        return;
      }

      try {
        // Find the follower record by unsubscribe token
        const { data: follower, error: findError } = await supabase
          .from('talent_followers')
          .select(`
            id,
            unsubscribed_at,
            talent_profiles (
              full_name
            )
          `)
          .eq('unsubscribe_token', token)
          .single();

        if (findError || !follower) {
          console.error('Follower not found:', findError);
          setStatus('error');
          return;
        }

        // Get talent name
        const talent = follower.talent_profiles as any;
        setTalentName(talent?.full_name || 'this creator');

        // Check if already unsubscribed
        if (follower.unsubscribed_at) {
          setStatus('already');
          return;
        }

        // Mark as unsubscribed
        const { error: updateError } = await supabase
          .from('talent_followers')
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq('id', follower.id);

        if (updateError) {
          console.error('Failed to unsubscribe:', updateError);
          setStatus('error');
          return;
        }

        setStatus('success');
      } catch (error) {
        console.error('Unsubscribe error:', error);
        setStatus('error');
      }
    };

    processUnsubscribe();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-white mb-2">Processing...</h1>
              <p className="text-gray-400">Please wait while we process your request.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-white mb-2">Unsubscribed Successfully</h1>
              <p className="text-gray-400 mb-6">
                You've been unsubscribed from updates from {talentName}. You will no longer receive emails from them.
              </p>
              <p className="text-gray-500 text-sm">
                Changed your mind? You can always re-subscribe by visiting their bio page.
              </p>
            </>
          )}

          {status === 'already' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-white mb-2">Already Unsubscribed</h1>
              <p className="text-gray-400">
                You've already unsubscribed from updates from {talentName}.
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-white mb-2">Something Went Wrong</h1>
              <p className="text-gray-400 mb-6">
                We couldn't process your unsubscribe request. The link may be invalid or expired.
              </p>
              <a 
                href="mailto:support@shoutout.us" 
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Contact Support
              </a>
            </>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <a href="https://shoutout.us/creators" className="inline-flex items-center gap-2 opacity-50 hover:opacity-70 transition-opacity">
              <img 
                src="https://utafetamgwukkbrlezev.supabase.co/storage/v1/object/public/platform-assets/logos/logo-1760990980777.png"
                alt="ShoutOut"
                className="h-5"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnsubscribePage;

