import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    fetchPromoVideos();
    fetchSpotsRemaining();
  }, []);

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
      // Start at 197, subtract how many are already signed up
      setSpotsRemaining(Math.max(0, 197 - (count || 0)));
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
        // Add to ActiveCampaign
        await addToActiveCampaign(email);
        
        // Update spots remaining
        setSpotsRemaining(prev => Math.max(0, prev - 1));
        
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
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Coming Soon
            </h1>
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

            {/* Video Carousel */}
            {promoVideos.length > 0 && (
              <div className="relative max-w-2xl mx-auto mt-6">
                <div className="relative">
                  {/* Video Container - Natural aspect ratio */}
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 mx-auto" style={{ maxWidth: '500px' }}>
                    <video
                      key={promoVideos[currentVideoIndex].id}
                      src={promoVideos[currentVideoIndex].video_url}
                      controls
                      className="w-full h-auto bg-black"
                      playsInline
                      preload="metadata"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        const video = e.currentTarget;
                        console.error('❌ Video load error:', promoVideos[currentVideoIndex].video_url);
                        console.error('Error details:', {
                          networkState: video.networkState,
                          readyState: video.readyState,
                          error: video.error
                        });
                      }}
                      onLoadedMetadata={(e) => {
                        const video = e.currentTarget;
                        console.log('✅ Video loaded successfully:', promoVideos[currentVideoIndex].video_url);
                        console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>

                  {/* Navigation Buttons */}
                  {promoVideos.length > 1 && (
                    <>
                      <button
                        onClick={prevVideo}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all backdrop-blur-sm"
                        aria-label="Previous video"
                      >
                        <ChevronLeftIcon className="h-6 w-6" />
                      </button>
                      <button
                        onClick={nextVideo}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all backdrop-blur-sm"
                        aria-label="Next video"
                      >
                        <ChevronRightIcon className="h-6 w-6" />
                      </button>

                      {/* Dots Indicator */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {promoVideos.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentVideoIndex(index)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              index === currentVideoIndex 
                                ? 'bg-white w-8' 
                                : 'bg-white/50 hover:bg-white/75'
                            }`}
                            aria-label={`Go to video ${index + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
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
