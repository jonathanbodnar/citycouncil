import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ClipboardDocumentIcon,
  VideoCameraIcon,
  GiftIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { Order } from '../types';
import toast from 'react-hot-toast';
import { generatePromoGraphic, downloadPromoGraphic } from '../services/promoGraphicGenerator';

interface PendingOrder extends Order {
  users: {
    full_name: string;
  };
}

const WelcomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileUrl, setProfileUrl] = useState('');
  const [promoVideoUrl, setPromoVideoUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [talentFullName, setTalentFullName] = useState('');
  const [generatingGraphic, setGeneratingGraphic] = useState(false);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [welcomeVideoUrl, setWelcomeVideoUrl] = useState('');

  // Soft launch date: November 24th, 2025
  const softLaunchDate = new Date('2025-11-24T00:00:00');
  const [timeUntilLaunch, setTimeUntilLaunch] = useState('');

  useEffect(() => {
    // Check if there's an order query parameter (from fulfillment link)
    const orderId = searchParams.get('order');
    if (orderId) {
      // Redirect to dashboard with order query param
      navigate(`/dashboard?order=${orderId}`, { replace: true });
      return;
    }

    if (user && user.user_type === 'talent') {
      fetchPendingOrders();
      fetchTalentProfile();
      fetchPayoutsEnabledSetting();
      fetchWelcomeVideo();
    } else if (user) {
      // Redirect non-talent users to their appropriate dashboard
      navigate('/home');
    } else if (!user) {
      // Redirect unauthenticated users to login with returnTo parameter
      navigate('/login?returnTo=/welcome', { replace: true });
    }
  }, [user, navigate, searchParams]);

  // Countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const diff = softLaunchDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilLaunch('Launch Day! 🎉');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      setTimeUntilLaunch(`${days}d ${hours}h`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchPayoutsEnabledSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payouts_enabled')
        .single();

      if (error) throw error;
      setPayoutsEnabled(data?.setting_value === 'true');
    } catch (error) {
      console.error('Error fetching payouts enabled setting:', error);
      // Default to false if setting doesn't exist
      setPayoutsEnabled(false);
    }
  };

  const fetchWelcomeVideo = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'welcome_video_url')
        .single();

      if (error) throw error;
      if (data?.setting_value) {
        setWelcomeVideoUrl(data.setting_value);
      }
    } catch (error) {
      console.error('Error fetching welcome video URL:', error);
      // Video is optional, so just log the error
    }
  };

  const fetchPendingOrders = async () => {
    try {
      // First, get the talent profile ID
      const { data: talentProfile, error: talentError } = await supabase
        .from('talent_profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (talentError) throw talentError;
      if (!talentProfile) {
        console.log('No talent profile found for user');
        setLoading(false);
        return;
      }

      // Now fetch orders using the talent profile ID
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          users!orders_user_id_fkey (
            full_name
          )
        `)
        .eq('talent_id', talentProfile.id)
        .in('status', ['pending', 'in_progress'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('📦 Pending orders fetched:', data?.length || 0);
      setPendingOrders(data || []);
    } catch (error) {
      console.error('Error fetching pending orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTalentProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          username, 
          promo_video_url,
          full_name,
          users!talent_profiles_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        const url = data.username 
          ? `${window.location.origin}/${data.username}`
          : `${window.location.origin}/talent/${user?.id}`;
        setProfileUrl(url);
        setPromoVideoUrl(data.promo_video_url || '');
        
        // Get full name - prefer talent_profiles.full_name (legal name) over users.full_name
        const userData = data.users as any;
        const talentProfileName = (data as any).full_name; // talent_profiles.full_name
        const userFullName = userData?.full_name; // users.full_name
        
        // Priority: talent_profiles.full_name > users.full_name > user?.full_name
        const finalName = talentProfileName || userFullName || user?.full_name || '';
        setTalentFullName(finalName);
        setAvatarUrl(userData?.avatar_url || user?.avatar_url || '');
        
        console.log('📝 WelcomePage - Name sources:');
        console.log('  - talent_profiles.full_name:', talentProfileName);
        console.log('  - users.full_name:', userFullName);
        console.log('  - user?.full_name:', user?.full_name);
        console.log('  - Final name set to state:', finalName);
        console.log('  - First name will be:', finalName?.split(' ')[0]);
      }
    } catch (error) {
      console.error('Error fetching talent profile:', error);
    }
  };

  const copyProfileUrl = () => {
    navigator.clipboard.writeText(profileUrl);
    toast.success('Profile link copied to clipboard!');
  };

  const copyPhoneNumber = () => {
    navigator.clipboard.writeText('(217) 589-8027');
    toast.success('Phone number copied to clipboard!');
  };

  const downloadPromoVideo = async () => {
    if (!promoVideoUrl) {
      toast.error('No promo video available');
      return;
    }

    try {
      // Video is already watermarked during upload - just download it directly
      toast.loading('Downloading video...', { id: 'download' });

      // Fetch the video as a blob to force download
      const response = await fetch(promoVideoUrl);
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${talentFullName?.replace(/\s+/g, '-') || 'ShoutOut'}-promo-video.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.dismiss('download');
      toast.success('Video downloaded!');
    } catch (error) {
      console.error('Error downloading video:', error);
      toast.dismiss();
      toast.error('Failed to download video');
    }
  };

  const handleGeneratePromoGraphic = async () => {
    // Debug logging
    console.log('🎨 Generating promo graphic...');
    console.log('Avatar URL:', avatarUrl);
    console.log('Talent Full Name:', talentFullName);
    console.log('User Full Name:', user?.full_name);
    console.log('Profile URL:', profileUrl);
    
    if (!avatarUrl) {
      toast.error('No profile photo available. Please add a profile photo first.');
      return;
    }

    setGeneratingGraphic(true);
    
    try {
      // Clean up the profile URL to just domain/path (e.g., "shoutout.us/username")
      let cleanUrl = profileUrl.replace(/^https?:\/\//, '').replace('www.', '');
      // Remove any port numbers for local dev
      cleanUrl = cleanUrl.replace(/:\d+/, '');
      // Replace any railway domain with shoutout.us
      cleanUrl = cleanUrl.replace(/frontend.*?\.railway\.app/gi, 'shoutout.us');
      // Convert to lowercase for consistency
      cleanUrl = cleanUrl.toLowerCase();
      
      // Use the talent's full name from the profile (e.g., "Jonathan Bodnar")
      let displayName = talentFullName || user?.full_name || 'You';
      
      // TEMPORARY FIX: Fix "Jonathanbodnar" to "Jonathan Bodnar"
      if (displayName === 'Jonathanbodnar' || displayName === 'Joanthan') {
        displayName = 'Jonathan Bodnar';
        console.log('🔧 Fixed name from', talentFullName || user?.full_name, 'to', displayName);
      }
      
      console.log('✅ Using display name:', displayName);
      console.log('✅ Using clean URL:', cleanUrl);
      console.log('✅ Using avatar URL:', avatarUrl);
      
      // Generate the graphic
      const blob = await generatePromoGraphic({
        avatarUrl,
        talentName: displayName,
        profileUrl: cleanUrl,
      });

      // Download the graphic
      const filename = `ShoutOut-${displayName.replace(/\s+/g, '-')}.png`;
      downloadPromoGraphic(blob, filename);

      toast.success('Promo graphic downloaded!');
    } catch (error) {
      console.error('❌ Error generating promo graphic:', error);
      toast.error('Failed to generate promo graphic. Please try again.');
    } finally {
      setGeneratingGraphic(false);
    }
  };

  // Use talent profile name for first name (already fetched in talentFullName state)
  const firstName = talentFullName?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">
            Welcome, {firstName}! 👋
          </h1>
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full gradient-border"
          >
            <ClockIcon className="h-5 w-5 text-blue-400" />
            <span className="text-white font-medium">
              <span className="hidden sm:inline">Soft Launch Countdown - Nov 24th 2025 · {timeUntilLaunch}</span>
              <span className="sm:hidden">Soft Launch - Nov 24th · {timeUntilLaunch}</span>
            </span>
          </div>
        </div>

        {/* Main Grid - Desktop: 3 boxes left, 1 tall box right | Mobile: Single column stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Orders */}
          <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6 order-1 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <ClipboardDocumentIcon className="h-6 w-6 text-blue-400" />
                <h2 className="text-2xl font-bold text-white">Pending Orders</h2>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-gray-400">Loading orders...</div>
              ) : pendingOrders.length > 0 ? (
                pendingOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/dashboard?tab=orders&order=${order.id}`}
                    className="block glass rounded-2xl p-4 border border-white/20 hover:border-blue-400 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">{order.users.full_name}</div>
                        <div className="text-sm text-gray-300">${(order.amount / 100).toFixed(2)}</div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'pending' 
                          ? 'bg-yellow-500/20 text-yellow-400' 
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {order.status === 'pending' ? 'New' : 'In Progress'}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12">
                  <CheckCircleIcon className="h-12 w-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">No pending orders</p>
                  <p className="text-sm text-gray-500 mt-1">You're all caught up! 🎉</p>
                </div>
              )}
            </div>
          </div>

          {/* Media Center */}
          <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6 order-3 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <ArrowDownTrayIcon className="h-6 w-6 text-green-400" />
                <h2 className="text-2xl font-bold text-white">Media Center</h2>
              </div>

              <p className="text-gray-300 text-sm mb-4">
                Here are some custom branded media promoting your profile ready for download and posting!
              </p>

              <div className="space-y-3">
                <button
                  onClick={downloadPromoVideo}
                  className="w-full glass rounded-xl p-4 border border-white/20 hover:border-green-400 transition-all hover:scale-[1.02] text-white font-medium flex items-center justify-center gap-2"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  Download your promo video
                </button>

                <button
                  onClick={handleGeneratePromoGraphic}
                  disabled={generatingGraphic || !avatarUrl}
                  className={`w-full glass rounded-xl p-4 border border-white/20 transition-all text-white font-medium flex items-center justify-center gap-2 ${
                    generatingGraphic || !avatarUrl
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:border-green-400 hover:scale-[1.02]'
                  }`}
                >
                  <ArrowDownTrayIcon className={`h-5 w-5 ${generatingGraphic ? 'animate-bounce' : ''}`} />
                  {generatingGraphic ? 'Generating...' : 'Download your promo graphic'}
                  {!avatarUrl && !generatingGraphic && (
                    <span className="text-xs text-gray-400">(add profile photo first)</span>
                  )}
                </button>

                {/* Instagram Collab Badge */}
                <div className="mt-3 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-400/30">
                  <p className="text-xs text-gray-300 mb-2 text-center">
                    Collab your posts with @shoutoutvoice on Instagram!
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('@shoutoutvoice');
                      toast.success('Instagram username copied!');
                    }}
                    className="w-full glass rounded-lg px-3 py-2 border border-white/20 hover:border-purple-400 transition-all text-white font-medium text-sm hover:scale-[1.02] flex items-center justify-center gap-2"
                  >
                    <span className="text-purple-300">@shoutoutvoice</span>
                    <ClipboardDocumentIcon className="h-4 w-4 text-purple-300" />
                  </button>
                </div>
                </div>
          </div>

          {/* Bonus & Promo Package */}
          <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6 order-4 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <GiftIcon className="h-6 w-6 text-yellow-400" />
                <h2 className="text-2xl font-bold text-white">Bonus & Promo Package</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">🎉</div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Zero Fees on First 10 Orders</h3>
                    <p className="text-gray-300 text-sm">
                      We've waived ShoutOut's 25% fee on your first 10 orders to help you get started!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="text-3xl">💰</div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">$250 Launch Bonus</h3>
                    <p className="text-gray-300 text-sm">
                      Complete your first 10 orders within 30 days of launch and receive a $250 bonus!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="text-3xl">🚀</div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">We'll spend to market your profile!</h3>
                    <p className="text-gray-300 text-sm">
                      Learn how to unlock $300/mo in free adspend we will use to promote your ShoutOut profile and boost your bookings!
                    </p>
                  </div>
                </div>

                <Link
                  to="/dashboard?tab=promotion"
                  className="block w-full text-center px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold rounded-xl hover:scale-105 transition-transform mt-4"
                >
                  View Full Details
                </Link>
              </div>
          </div>

          {/* Right Column - Welcome Video & Quick Start Tips (spans 2 columns on desktop) */}
          <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-6 order-2 lg:col-span-2 lg:row-span-3">
            <div className="flex items-center gap-3 mb-4">
              <VideoCameraIcon className="h-6 w-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">Welcome Video</h2>
            </div>
            
            {/* Welcome Video Embed */}
            <div className="mb-4 flex justify-center">
              {welcomeVideoUrl ? (
                <video
                  src={welcomeVideoUrl}
                  controls
                  preload="auto"
                  playsInline
                  className="rounded-2xl border border-white/20 shadow-lg max-h-[600px] w-auto"
                  style={{ maxWidth: '100%' }}
                  onLoadedMetadata={(e) => {
                    // Force poster frame to show
                    const video = e.currentTarget;
                    video.currentTime = 0.1;
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="aspect-video w-full bg-gradient-to-br from-blue-900/50 to-red-900/50 rounded-2xl flex items-center justify-center border border-white/20">
                  <div className="text-center">
                    <VideoCameraIcon className="h-16 w-16 text-white/50 mx-auto mb-2" />
                    <p className="text-white/70 text-sm">Welcome video coming soon...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Start Tips */}
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-lg">Quick Start Tips:</h3>
              
              <div className="space-y-4 text-base text-gray-300">
                <div>
                  <strong className="text-white">1. Fulfilling orders:</strong> we will text you from{' '}
                  <button
                    onClick={copyPhoneNumber}
                    className="text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                  >
                    (217) 589-8027
                  </button>{' '}
                  with a link when you get an order, follow the link to fulfill the order.
                  <div className="mt-2 p-3 bg-blue-500/10 border border-blue-400/30 rounded-lg">
                    <span className="text-sm text-blue-200">
                      💡 <strong>Tip:</strong> You can respond to texts we send through that number for help or just to say hi! 
                      We will use this number to text you about platform updates, so please save it!
                    </span>
                  </div>
                </div>

                <div>
                  <strong className="text-white">2. Share your link:</strong>{' '}
                  <button
                    onClick={copyProfileUrl}
                    className="text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                  >
                    {profileUrl || 'Loading...'}
                  </button>
                </div>

                <div>
                  <strong className="text-white">3. Setup Payouts:</strong>{' '}
                  {payoutsEnabled ? (
                    <>
                      <Link 
                        to="/dashboard?tab=payouts" 
                        className="text-blue-400 hover:text-blue-300 underline font-medium"
                      >
                        Click here
                      </Link>{' '}
                      to securely setup your payouts and receive payments for your orders.
                    </>
                  ) : (
                    <span className="text-gray-300">
                      we will enable payouts shortly. Once all security checks are complete.
                    </span>
                  )}
                </div>

                <div>
                  <strong className="text-white">4. First 10 Orders:</strong> we've waived ShoutOut's 25% fee 
                  on your first 10 orders. Also if you hit your first 10 orders within 30 days of launch 
                  you'll receive a <strong className="text-green-400">$250 bonus</strong>!
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Link to Full Dashboard */}
        <div className="mt-8 text-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 glass-strong rounded-xl border border-white/30 text-white hover:border-blue-400 transition-all"
          >
            Go to Full Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;

