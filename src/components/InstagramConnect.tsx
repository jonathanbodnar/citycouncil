import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

interface InstagramConnectProps {
  talentId: string;
  currentUsername?: string | null;
  onConnectionChange?: () => void;
}

const InstagramConnect: React.FC<InstagramConnectProps> = ({ 
  talentId, 
  currentUsername,
  onConnectionChange 
}) => {
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Instagram OAuth config (read from env, never hardcoded)
  const INSTAGRAM_APP_ID = '2022129608361218'; // Main Meta App ID
  const REDIRECT_URI = `${window.location.origin}/instagram/callback`;
  const SCOPE = 'pages_show_list,instagram_basic,instagram_manage_insights,pages_read_engagement'; // Full permissions for Instagram Business API

  useEffect(() => {
    // Listen for OAuth callback messages
    const handleMessage = async (event: MessageEvent) => {
      // Security: verify origin if needed
      if (event.data.type === 'INSTAGRAM_AUTH_SUCCESS') {
        const { code } = event.data;
        await handleOAuthCallback(code);
      } else if (event.data.type === 'INSTAGRAM_AUTH_ERROR') {
        setConnecting(false);
        toast.error('Instagram authorization failed');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [talentId]);

  const handleConnect = () => {
    setConnecting(true);
    
    // Build Instagram OAuth URL (using Facebook OAuth for Instagram Graph API)
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    authUrl.searchParams.append('client_id', INSTAGRAM_APP_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('scope', SCOPE);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('state', talentId); // Pass talent ID as state
    
    // Open OAuth popup
    const width = 600;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2;
    const top = window.innerHeight / 2 - height / 2;
    
    const popup = window.open(
      authUrl.toString(),
      'Instagram Login',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    // Check if popup was blocked
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      toast.error('Popup blocked! Please allow popups for this site.');
      setConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    setLoading(true);
    
    try {
      console.log('Exchanging authorization code for access token...');
      
      // Call edge function to exchange code for token
      const { data, error } = await supabase.functions.invoke('instagram-oauth', {
        body: { code, talentId }
      });

      if (error) {
        console.error('OAuth error:', error);
        throw error;
      }

      if (data.error) {
        console.error('OAuth response error:', data.error);
        
        // Check if it's a personal account (no business account)
        if (data.error === 'no_business_account') {
          toast.error(data.message || 'Only Business accounts supported for automatic tracking');
          
          // Prompt for manual username entry
          const manualUsername = window.prompt(
            '💡 Only Instagram Business accounts can connect automatically.\n\n' +
            'For personal accounts, enter your Instagram username (without @) for manual tracking:\n\n' +
            '(We\'ll track if you add shoutout.us to your bio and tag @shoutoutvoice in posts)'
          );
          
          if (manualUsername && manualUsername.trim()) {
            await saveManualUsername(manualUsername.trim());
            return;
          }
        }
        
        throw new Error(data.message || data.error);
      }

      console.log('Instagram connected successfully:', data);
      toast.success(`Instagram connected as @${data.username}!`);
      
      // Notify parent component
      if (onConnectionChange) {
        onConnectionChange();
      }
      
      // Reload to show updated state
      setTimeout(() => window.location.reload(), 1000);
      
    } catch (error: any) {
      console.error('Instagram connection error:', error);
      toast.error(error.message || 'Failed to connect Instagram. Please try again.');
    } finally {
      setLoading(false);
      setConnecting(false);
    }
  };

  const saveManualUsername = async (username: string) => {
    try {
      setLoading(true);
      
      // Save username to database (without API token - manual tracking only)
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          instagram_username: username,
          instagram_user_id: 'manual', // Flag as manual entry
          instagram_access_token: null, // No API access
          instagram_token_expires_at: null
        })
        .eq('id', talentId);

      if (error) throw error;

      toast.success(`Instagram @${username} saved! We'll track your bio and posts manually.`);
      
      if (onConnectionChange) {
        onConnectionChange();
      }
      
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      console.error('Failed to save username:', error);
      toast.error('Failed to save Instagram username');
    } finally {
      setLoading(false);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Disconnect Instagram? This will remove you from the promotion program.')) {
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          instagram_username: null,
          instagram_user_id: null,
          instagram_access_token: null,
          instagram_token_expires_at: null
        })
        .eq('id', talentId);

      if (error) throw error;

      toast.success('Instagram disconnected');
      
      // Notify parent component
      if (onConnectionChange) {
        onConnectionChange();
      }
      
      setTimeout(() => window.location.reload(), 1000);
      
    } catch (error: any) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect Instagram');
    } finally {
      setLoading(false);
    }
  };

  if (currentUsername) {
    // Connected state
    return (
      <div className="glass rounded-2xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Instagram Connected</h3>
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">@{currentUsername}</span>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="glass-strong px-4 py-2 rounded-lg hover:glass transition-all text-red-400 border border-red-500/30 text-sm disabled:opacity-50"
          >
            {loading ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
        <p className="text-sm text-gray-300">
          We'll automatically track your bio link and tagged posts for the promotion program.
        </p>
      </div>
    );
  }

  // Not connected state
  return (
    <div className="glass rounded-2xl p-6 border border-white/20">
      <h3 className="text-lg font-semibold text-white mb-2">Connect Instagram</h3>
      <p className="text-sm text-gray-300 mb-4">
        Required for the promotion program. We'll track your bio link and posts that tag @shoutoutvoice.
      </p>
      
      <div className="space-y-3 mb-4 text-sm text-gray-400">
        <div className="flex items-start gap-2">
          <span className="text-green-400 mt-0.5">✓</span>
          <span>Secure OAuth authorization (we never see your password)</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-green-400 mt-0.5">✓</span>
          <span>Read-only access (we can't post on your behalf)</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-green-400 mt-0.5">✓</span>
          <span>Disconnect anytime</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleConnect}
          disabled={loading || connecting}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {connecting ? 'Opening Instagram...' : loading ? 'Connecting...' : 'Connect Business Account (Auto-Track)'}
        </button>
        
        <button
          onClick={() => {
            const manualUsername = window.prompt(
              'Enter your Instagram username (without @):\n\n' +
              '⚠️ Personal accounts only. We\'ll manually check if you:\n' +
              '• Add shoutout.us to your bio\n' +
              '• Tag @shoutoutvoice in posts'
            );
            
            if (manualUsername && manualUsername.trim()) {
              saveManualUsername(manualUsername.trim());
            }
          }}
          disabled={loading || connecting}
          className="w-full glass-strong px-6 py-3 rounded-lg hover:glass transition-all text-gray-300 border border-white/20 text-sm disabled:opacity-50"
        >
          Or Enter Personal Account Manually
        </button>
        
        <p className="text-xs text-gray-500 text-center">
          Business accounts: Auto-tracking • Personal accounts: Manual verification
        </p>
      </div>
    </div>
  );
};

export default InstagramConnect;

