import React, { useState, useEffect } from 'react';
import { XMarkIcon, SparklesIcon, GiftIcon, MegaphoneIcon } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface PromoPackageModalProps {
  onClose: () => void;
}

const PromoPackageModal: React.FC<PromoPackageModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [spotsRemaining, setSpotsRemaining] = useState(25);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [hasClaimedPromo, setHasClaimedPromo] = useState(false);

  useEffect(() => {
    checkIfAlreadyClaimed();
  }, [user]);

  const checkIfAlreadyClaimed = async () => {
    if (!user?.id) return;

    try {
      // Check if user is talent and has already claimed promo
      const { data, error } = await supabase
        .from('talent_profiles')
        .select('is_participating_in_promotion')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error checking promo status:', error);
        return;
      }

      if (data?.is_participating_in_promotion) {
        setHasClaimedPromo(true);
        // If they've already claimed, close the modal
        onClose();
        return;
      }

      // If not claimed yet, fetch spots remaining
      await fetchSpotsRemaining();
    } catch (error) {
      console.error('Error checking promo claim status:', error);
      setLoading(false);
    }
  };

  const fetchSpotsRemaining = async () => {
    try {
      // Count how many talent have claimed the promo
      const { count, error } = await supabase
        .from('talent_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_participating_in_promotion', true);

      if (error) throw error;
      
      const remaining = Math.max(0, 25 - (count || 0));
      setSpotsRemaining(remaining);
    } catch (error) {
      console.error('Error fetching spots count:', error);
      setSpotsRemaining(25); // Default to 25 if error
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPromo = () => {
    // Navigate to dashboard promotion tab
    navigate('/dashboard?tab=promotion');
    onClose();
  };

  const handleDismiss = () => {
    // Store that user has seen the modal
    if (user?.id) {
      localStorage.setItem(`promo-modal-seen-${user.id}`, 'true');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-2 sm:p-4">
      <div 
        className="glass-strong rounded-2xl sm:rounded-3xl shadow-2xl border border-white/30 max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto relative"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
          backdropFilter: 'blur(40px)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 rounded-full glass hover:glass-strong transition-all duration-200 z-10"
        >
          <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
        </button>

        {/* Header */}
        <div className="text-center p-4 sm:p-8 pb-4 sm:pb-6">
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-blue-600 blur-xl opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-r from-red-600 to-blue-600 p-3 sm:p-4 rounded-full">
                <GiftIcon className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
              </div>
            </div>
          </div>
          
          <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
            <SparklesIcon className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400" />
            <span>Exclusive Offers for Talent!</span>
            <SparklesIcon className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400" />
          </h2>
          
          {!loading && spotsRemaining > 0 && (
            <div className="inline-block mt-3 sm:mt-4">
              <div className="glass-strong px-4 py-2 sm:px-6 sm:py-3 rounded-full border border-red-500/50">
                <span className="text-red-400 font-bold text-base sm:text-lg">
                  🔥 Only {spotsRemaining} Spots Left!
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-4 sm:px-8 pb-4 sm:pb-8 space-y-4 sm:space-y-6">
          {/* Bonus Offer */}
          <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-green-500/30">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="text-3xl sm:text-5xl">💰</div>
              <div className="flex-1">
                <h3 className="text-lg sm:text-2xl font-bold text-white mb-2">
                  First 10 Orders Bonus
                </h3>
                <div className="space-y-1.5 sm:space-y-2 text-gray-200 text-sm sm:text-base">
                  <p className="flex items-center gap-2">
                    <span className="text-green-400 flex-shrink-0">✓</span>
                    <span><strong className="text-green-400">0% Platform Fee</strong> on your first 10 orders</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-green-400 flex-shrink-0">✓</span>
                    <span><strong>Keep 100%</strong> of your earnings (minus charity if set)</span>
                  </p>
                  <p className="text-xs sm:text-sm text-gray-300 mt-2">
                    After 10 orders, standard 25% platform fee applies
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Promo Package */}
          <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-blue-500/30">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="text-4xl sm:text-5xl flex-shrink-0">
                <MegaphoneIcon className="h-10 w-10 sm:h-12 sm:w-12 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <h3 className="text-lg sm:text-2xl font-bold text-white">
                    Promotion Package
                  </h3>
                  <span className="text-xs sm:text-sm font-bold text-green-400 bg-green-500/20 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border border-green-500/30">
                    FREE
                  </span>
                </div>
                
                <div className="space-y-2 sm:space-y-3 text-gray-200">
                  <div className="glass-subtle rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-500/20">
                    <p className="font-bold text-blue-400 text-base sm:text-lg mb-1">
                      📢 $300/month in Ad Spend
                    </p>
                    <p className="text-xs sm:text-sm text-gray-300">
                      We advertise YOUR profile on Rumble & Instagram
                    </p>
                  </div>

                  <div className="text-xs sm:text-sm space-y-2">
                    <p className="font-semibold text-white">Requirements:</p>
                    <ul className="space-y-1.5 ml-2 sm:ml-4">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>
                        <span className="break-words">Add your ShoutOut link to your social media bios</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>
                        <span className="break-words">Post promo video on Instagram stories 2x/month</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>
                        <span className="break-words">Post 1 ShoutOut video/month (collab @shoutoutvoice)</span>
                      </li>
                    </ul>
                  </div>

                  {!loading && spotsRemaining <= 5 && spotsRemaining > 0 && (
                    <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-xs sm:text-sm font-semibold text-center">
                        ⚠️ Almost Full! Only {spotsRemaining} spots remaining
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-2.5 sm:space-y-3 pt-2 sm:pt-4">
            {spotsRemaining > 0 ? (
              <button
                onClick={handleJoinPromo}
                disabled={claiming}
                className="w-full bg-gradient-to-r from-red-600 to-blue-600 text-white py-3 sm:py-4 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg hover:from-red-700 hover:to-blue-700 transition-all duration-300 shadow-2xl hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  boxShadow: '0 0 30px rgba(239, 68, 68, 0.3)',
                }}
              >
                {claiming ? 'Processing...' : '🎁 Join Promotion Package Now!'}
              </button>
            ) : (
              <div className="w-full bg-gray-600 text-white py-3 sm:py-4 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg text-center opacity-50 cursor-not-allowed">
                😢 All Spots Taken
              </div>
            )}
            
            <button
              onClick={handleDismiss}
              className="w-full glass hover:glass-strong text-white py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-medium text-sm sm:text-base transition-all duration-200 border border-white/30"
            >
              Maybe Later
            </button>

            <p className="text-xs text-gray-400 text-center pt-1">
              You can access these offers anytime from your Dashboard
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoPackageModal;

