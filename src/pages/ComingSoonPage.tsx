import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  PlayIcon, 
  StarIcon, 
  HeartIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/solid';
import { supabase } from '../services/supabase';
import { addToActiveCampaign } from '../services/activecampaign';
import Logo from '../components/Logo';
import toast from 'react-hot-toast';

const ComingSoonPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [spotsRemaining, setSpotsRemaining] = useState(197);
  const [promoVideos, setPromoVideos] = useState<any[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});

  useEffect(() => {
    fetchPromoVideos();
    fetchSpotsRemaining();
  }, []);

  // Pause all videos except the active one
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([index, videoEl]) => {
      if (videoEl) {
        const idx = parseInt(index);
        if (idx !== currentVideoIndex && !videoEl.paused) {
          videoEl.pause();
          videoEl.currentTime = 0; // Reset to beginning
        }
      }
    });
  }, [currentVideoIndex]);

  const fetchPromoVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('landing_promo_videos')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      console.log('Fetched promo videos for landing:', data);
      setPromoVideos(data || []);
    } catch (error) {
      console.error('Error fetching promo videos:', error);
    }
  };

  const fetchSpotsRemaining = async () => {
    try {
      const { count, error } = await supabase
        .from('email_waitlist')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      
      console.log('📊 Email waitlist count:', count);
      const remaining = Math.max(0, 197 - (count || 0));
      console.log('📊 Spots remaining:', remaining);
      
      setSpotsRemaining(remaining);
    } catch (error) {
      console.error('Error fetching spots count:', error);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);
    
    try {
      // Add to database
      const { error } = await supabase
        .from('email_waitlist')
        .insert({
          email: email.toLowerCase().trim(),
          source: 'landing_page',
          discount_code: '25OFF',
          created_at: new Date().toISOString()
        });

      if (error) {
        if (error.code === '23505') {
          setSubmitted(true);
          toast.success('You\'re already on the list! 🎉');
        } else {
          throw error;
        }
      } else {
        console.log('✅ Email added to database successfully');
        
        // Add to ActiveCampaign (don't fail if this errors)
        try {
          console.log('📧 Adding to ActiveCampaign:', email);
          const acResult = await addToActiveCampaign(email);
          console.log('📧 ActiveCampaign result:', acResult);
          if (!acResult.success) {
            console.error('❌ ActiveCampaign failed:', acResult.error);
          }
        } catch (acError) {
          console.error('❌ ActiveCampaign error:', acError);
          // Continue anyway - don't block user signup
        }
        
        // Refresh spots remaining from database
        console.log('🔄 Refreshing spots count...');
        await fetchSpotsRemaining();
        console.log('✅ Spots count refreshed');
        
        setSubmitted(true);
        setEmail('');
      }
    } catch (error: any) {
      console.error('Error adding to waitlist:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const nextVideo = () => {
    setCurrentVideoIndex((prev) => (prev + 1) % promoVideos.length);
  };

  const prevVideo = () => {
    setCurrentVideoIndex((prev) => (prev - 1 + promoVideos.length) % promoVideos.length);
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      {/* Header */}
      <header className="glass border-b border-white/10 backdrop-blur-xl px-4 py-6">
        <div className="max-w-7xl mx-auto flex justify-center">
          <Logo size="lg" theme="dark" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-12">
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Get personalized video messages from your favorite conservative voices, 
              politicians, and media personalities.
            </p>
          </div>

          {/* CTA Section */}
          <div className="glass-strong rounded-2xl p-8 border border-white/20 mb-8 shadow-2xl">
            <h2 className="text-4xl font-bold text-white mb-4">
              Join our beta launch and get 25% off.
            </h2>
            
            {!submitted ? (
              <>
                <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="px-6 py-4 rounded-xl bg-white/10 text-white placeholder-gray-400 border border-white/30 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:outline-none w-full sm:w-auto sm:min-w-96 backdrop-blur-sm"
                    disabled={loading}
                  />
                  <button 
                    type="submit"
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold transition-all flex items-center gap-2 w-full sm:w-auto shadow-lg disabled:opacity-50"
                  >
                    {loading ? 'Joining...' : 'Claim Beta Spot'}
                    <ArrowRightIcon className="h-5 w-5" />
                  </button>
                </form>

                {/* Spots Remaining Ticker */}
                <div className="text-center">
                  <p className="text-yellow-400 font-semibold text-lg animate-pulse">
                    ⚡ Only {spotsRemaining} spots remain
                  </p>
                </div>
              </>
            ) : (
              <div className="py-6">
                <p className="text-green-400 text-xl font-semibold">
                  Thank you! We'll let you know when the app is ready for beta orders!
                </p>
              </div>
            )}

            {/* Video Carousel - Swipeable Stack */}
            {promoVideos.length > 0 && (
              <div className="relative mx-auto mt-6 mb-12 w-full max-w-sm md:max-w-md lg:max-w-lg" style={{ height: '450px' }}>
                {promoVideos.map((video, index) => {
                  const offset = index - currentVideoIndex;
                  const isActive = index === currentVideoIndex;
                  const isVisible = Math.abs(offset) <= 2;
                  
                  if (!isVisible) return null;
                  
                  return (
                    <div
                      key={video.id}
                      className="absolute transition-all duration-500 ease-out cursor-pointer"
                      style={{
                        transform: `translateX(${offset * 20}px) translateY(${Math.abs(offset) * 15}px) scale(${1 - Math.abs(offset) * 0.05})`,
                        opacity: isActive ? 1 : 0.6,
                        zIndex: promoVideos.length - Math.abs(offset),
                        pointerEvents: isActive ? 'auto' : 'none',
                        width: '100%',
                        height: '450px'
                      }}
                      onClick={() => {
                        if (isActive) return;
                        setCurrentVideoIndex(index);
                      }}
                      onTouchStart={(e) => {
                        if (!isActive) return;
                        const touch = e.touches[0];
                        const startX = touch.clientX;
                        
                        const handleTouchMove = (e: TouchEvent) => {
                          const currentX = e.touches[0].clientX;
                          const diff = startX - currentX;
                          
                          if (Math.abs(diff) > 50) {
                            if (diff > 0 && currentVideoIndex < promoVideos.length - 1) {
                              nextVideo();
                            } else if (diff < 0 && currentVideoIndex > 0) {
                              prevVideo();
                            }
                            document.removeEventListener('touchmove', handleTouchMove);
                            document.removeEventListener('touchend', handleTouchEnd);
                          }
                        };
                        
                        const handleTouchEnd = () => {
                          document.removeEventListener('touchmove', handleTouchMove);
                          document.removeEventListener('touchend', handleTouchEnd);
                        };
                        
                        document.addEventListener('touchmove', handleTouchMove);
                        document.addEventListener('touchend', handleTouchEnd);
                      }}
                    >
                      <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 bg-black" style={{ height: '450px' }}>
                        <video
                          ref={(el) => {
                            videoRefs.current[index] = el;
                          }}
                          src={video.video_url}
                          poster={video.video_url + '#t=0.5'}
                          controls={isActive}
                          className="w-full h-full object-cover bg-black"
                          playsInline
                          preload="metadata"
                          muted={!isActive}
                          onError={(e) => {
                            const videoEl = e.currentTarget;
                            console.error('❌ Video load error:', video.video_url);
                            console.error('Error details:', {
                              networkState: videoEl.networkState,
                              readyState: videoEl.readyState,
                              error: videoEl.error
                            });
                          }}
                          onLoadedMetadata={(e) => {
                            const videoEl = e.currentTarget;
                            console.log('✅ Video loaded successfully:', video.video_url);
                            console.log('Video dimensions:', videoEl.videoWidth, 'x', videoEl.videoHeight);
                          }}
                        >
                          Your browser does not support the video tag.
                        </video>
                        {!isActive && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                            <PlayIcon className="h-16 w-16 text-white opacity-75" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Dots Indicator */}
                {promoVideos.length > 1 && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2" style={{ bottom: '-40px' }}>
                    {promoVideos.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentVideoIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentVideoIndex 
                            ? 'bg-white w-8' 
                            : 'bg-white/40 hover:bg-white/60'
                        }`}
                        aria-label={`Go to video ${index + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="glass rounded-xl p-6 border border-white/10">
              <PlayIcon className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Personal Videos
              </h3>
              <p className="text-gray-300 text-sm">
                Custom video messages for birthdays, celebrations, and special occasions
              </p>
            </div>
            
            <div className="glass rounded-xl p-6 border border-white/10">
              <StarIcon className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Verified Talent
              </h3>
              <p className="text-gray-300 text-sm">
                Authentic personalities including politicians, hosts, and commentators
              </p>
            </div>
            
            <div className="glass rounded-xl p-6 border border-white/10">
              <HeartIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Support Causes
              </h3>
              <p className="text-gray-300 text-sm">
                Every purchase supports conservative causes and charities
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="glass border-t border-white/10 backdrop-blur-xl px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center text-gray-300">
            <p>&copy; 2024 ShoutOut. All rights reserved.</p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <Link to="/privacy-policy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms-of-service" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ComingSoonPage;
