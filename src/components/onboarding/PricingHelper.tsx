import React, { useEffect, useState } from 'react';

interface PricingHelperProps {
  followers: number;
  onFollowersChange: (followers: number) => void;
  price: number;
  onPriceChange: (price: number) => void;
}

const PRICING_TIERS = [
  { maxFollowers: 300000, suggestedPrice: 27, label: 'Under 300K followers' },
  { maxFollowers: 1000000, suggestedPrice: 47, label: '300K - 1M followers' },
  { maxFollowers: Infinity, suggestedPrice: 97, label: 'Over 1M followers' },
];

const PricingHelper: React.FC<PricingHelperProps> = ({
  followers,
  onFollowersChange,
  price,
  onPriceChange,
}) => {
  const [displayFollowers, setDisplayFollowers] = useState('');
  const [useCustomPrice, setUseCustomPrice] = useState(false);

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US');
  };

  // Get suggested price based on followers
  const getSuggestedPrice = (followerCount: number): number => {
    for (const tier of PRICING_TIERS) {
      if (followerCount <= tier.maxFollowers) {
        return tier.suggestedPrice;
      }
    }
    return PRICING_TIERS[PRICING_TIERS.length - 1].suggestedPrice;
  };

  // Get current tier label
  const getCurrentTierLabel = (followerCount: number): string => {
    for (const tier of PRICING_TIERS) {
      if (followerCount <= tier.maxFollowers) {
        return tier.label;
      }
    }
    return PRICING_TIERS[PRICING_TIERS.length - 1].label;
  };

  // Update display when followers prop changes
  useEffect(() => {
    if (followers > 0) {
      setDisplayFollowers(formatNumber(followers));
    }
  }, []);

  // Handle follower input change
  const handleFollowersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10) || 0;

    setDisplayFollowers(raw ? formatNumber(num) : '');
    onFollowersChange(num);

    // Auto-update price unless user has set custom
    if (!useCustomPrice && num > 0) {
      onPriceChange(getSuggestedPrice(num));
    }
  };

  // Handle price input change
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setUseCustomPrice(true);
    onPriceChange(value);
  };

  // Use suggested price
  const useSuggestedPrice = () => {
    setUseCustomPrice(false);
    onPriceChange(getSuggestedPrice(followers));
  };

  const suggestedPrice = getSuggestedPrice(followers);
  const isUsingSuggested = price === suggestedPrice && !useCustomPrice;

  return (
    <div className="space-y-4">
      {/* Price Input - shown first */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Your Price per Video ($) *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">$</span>
          <input
            type="number"
            required
            min="10"
            step="1"
            value={price || ''}
            onChange={handlePriceChange}
            className="w-full pl-7 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-gray-900"
            placeholder="50"
          />
        </div>
      </div>

      {/* Follower Count Input - optional helper */}
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-sm text-gray-600 mb-3">
          Need help knowing what to charge? Enter your total followers and we'll help you determine the appropriate pricing.
        </p>
        <input
          type="text"
          inputMode="numeric"
          value={displayFollowers}
          onChange={handleFollowersChange}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="e.g., 50,000"
        />
        
        {/* Suggested Price Display */}
        {followers > 0 && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700">Suggested Price for {getCurrentTierLabel(followers)}</p>
                <p className="text-lg font-bold text-emerald-600">${suggestedPrice}</p>
              </div>
              {!isUsingSuggested && (
                <button
                  type="button"
                  onClick={useSuggestedPrice}
                  className="text-xs text-emerald-600 hover:text-emerald-700 underline font-medium"
                >
                  Use this price
                </button>
              )}
            </div>
            {isUsingSuggested && (
              <p className="text-xs text-emerald-600 mt-1">✓ Using suggested price</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PricingHelper;
