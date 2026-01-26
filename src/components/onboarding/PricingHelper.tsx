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
      {/* Follower Count Input */}
      <div>
        <label className="block text-xs font-medium text-white mb-1">
          How many Instagram followers do you have?
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={displayFollowers}
          onChange={handleFollowersChange}
          className="w-full px-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., 50,000"
        />
        {followers > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            {getCurrentTierLabel(followers)}
          </p>
        )}
      </div>

      {/* Suggested Price Display */}
      {followers > 0 && (
        <div className="glass border border-white/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Suggested Price</p>
              <p className="text-lg font-bold text-green-400">${suggestedPrice}</p>
            </div>
            {!isUsingSuggested && (
              <button
                type="button"
                onClick={useSuggestedPrice}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Use suggested
              </button>
            )}
          </div>
        </div>
      )}

      {/* Price Input */}
      <div>
        <label className="block text-xs font-medium text-white mb-1">
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
            className="w-full pl-7 pr-3 py-2 text-sm glass border border-white/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="27"
          />
        </div>
        {isUsingSuggested && followers > 0 && (
          <p className="text-xs text-green-400 mt-1">
            Using suggested price based on your followers
          </p>
        )}
        {useCustomPrice && (
          <p className="text-xs text-gray-400 mt-1">
            Custom price set
          </p>
        )}
      </div>

      {/* Pricing Tier Reference */}
      <div className="glass border border-white/20 rounded-lg p-3">
        <p className="text-xs font-medium text-white mb-2">Pricing Guide</p>
        <div className="space-y-1">
          {PRICING_TIERS.map((tier, index) => (
            <div key={index} className="flex justify-between text-xs">
              <span className="text-gray-400">{tier.label}</span>
              <span className="text-white font-medium">${tier.suggestedPrice}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingHelper;
