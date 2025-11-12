# Coupon System Implementation Guide

## Overview
Complete coupon system with admin management panel, order form integration, and Fortis payment integration.

## Step 1: Database Migration ✅
Run `database/create_coupons_system.sql` in Supabase SQL Editor

## Step 2: Add Coupon Management to Admin Dashboard

In `src/pages/AdminDashboard.tsx`, add:

```typescript
import CouponManagement from '../components/CouponManagement';

// Add to tab list
{ value: 'coupons', label: 'Coupons', icon: TagIcon }

// Add to tab content
{activeTab === 'coupons' && <CouponManagement />}
```

## Step 3: Update OrderPage.tsx

### Add state and imports at top:
```typescript
import { TagIcon } from '@heroicons/react/24/outline';

// Add state
const [couponCode, setCouponCode] = useState('');
const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
const [couponLoading, setCouponLoading] = useState(false);
const [couponError, setCouponError] = useState('');
```

### Update calculatePricing function:
```typescript
const calculatePricing = () => {
  const isForBusiness = getValues('isForBusiness');
  const baseAmount = isForBusiness && talent.allow_corporate_pricing
    ? talent.corporate_pricing
    : talent.pricing;
  
  const subtotal = baseAmount;
  const adminFee = subtotal * (talent.admin_fee_percentage / 100);
  const charityAmount = talent.charity_percentage 
    ? subtotal * (talent.charity_percentage / 100) 
    : 0;
  
  let total = subtotal + adminFee + charityAmount;
  let discount = 0;

  // Apply coupon if valid
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === 'percentage') {
      discount = (total * appliedCoupon.discount_value / 100);
      if (appliedCoupon.max_discount_amount && discount > appliedCoupon.max_discount_amount) {
        discount = appliedCoupon.max_discount_amount;
      }
    } else {
      discount = appliedCoupon.discount_value;
    }
    
    if (discount > total) discount = total;
    total = total - discount;
  }

  return { 
    subtotal, 
    adminFee, 
    charityAmount, 
    discount,
    total 
  };
};
```

### Add validateCoupon function:
```typescript
const validateCoupon = async () => {
  if (!couponCode.trim()) {
    setCouponError('Please enter a coupon code');
    return;
  }

  setCouponLoading(true);
  setCouponError('');

  try {
    const pricing = calculatePricing();
    
    // Call validation function
    const { data, error } = await supabase
      .rpc('validate_and_apply_coupon', {
        p_coupon_code: couponCode.trim(),
        p_user_id: user?.id,
        p_order_amount: pricing.total
      });

    if (error) throw error;

    const result = data[0];
    
    if (!result.valid) {
      setCouponError(result.message);
      setAppliedCoupon(null);
      return;
    }

    // Get full coupon details
    const { data: couponData, error: couponFetchError } = await supabase
      .from('coupons')
      .select('*')
      .eq('id', result.coupon_id)
      .single();

    if (couponFetchError) throw couponFetchError;

    setAppliedCoupon(couponData);
    toast.success(result.message);
  } catch (error) {
    console.error('Error validating coupon:', error);
    setCouponError('Failed to validate coupon');
    setAppliedCoupon(null);
  } finally {
    setCouponLoading(false);
  }
};
```

### Add coupon UI to pricing sidebar (around line 697):
```typescript
{/* Coupon Code Input */}
<div className="border-t border-gray-200 pt-4 space-y-2">
  <label className="block text-sm font-medium text-gray-700">
    Have a coupon code?
  </label>
  <div className="flex gap-2">
    <input
      type="text"
      value={couponCode}
      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
      placeholder="Enter code"
      disabled={!!appliedCoupon}
      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm disabled:bg-gray-100"
    />
    {!appliedCoupon ? (
      <button
        type="button"
        onClick={validateCoupon}
        disabled={couponLoading || !couponCode.trim()}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        {couponLoading ? 'Checking...' : 'Apply'}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => {
          setAppliedCoupon(null);
          setCouponCode('');
          setCouponError('');
        }}
        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
      >
        Remove
      </button>
    )}
  </div>
  
  {couponError && (
    <p className="text-xs text-red-600">{couponError}</p>
  )}
  
  {appliedCoupon && (
    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
      <TagIcon className="h-4 w-4 text-green-600" />
      <span className="text-xs text-green-800 font-medium">
        Coupon "{appliedCoupon.code}" applied!
      </span>
    </div>
  )}
</div>

{/* Update pricing display to show discount */}
{pricing.discount > 0 && (
  <div className="flex justify-between text-green-600">
    <span className="flex items-center">
      <TagIcon className="h-4 w-4 mr-1" />
      Coupon Discount
    </span>
    <span className="font-medium">
      -${pricing.discount.toFixed(2)}
    </span>
  </div>
)}
```

### Update order insert to include coupon data (around line 200):
```typescript
{
  user_id: user.id,
  talent_id: talent.id,
  request_details: orderData.requestDetails,
  amount: Math.round(pricing.total * 100),
  original_amount: appliedCoupon ? Math.round((pricing.total + pricing.discount) * 100) : null,
  discount_amount: appliedCoupon ? Math.round(pricing.discount * 100) : null,
  coupon_id: appliedCoupon?.id || null,
  coupon_code: appliedCoupon?.code || null,
  // ... rest of fields
}
```

### Update coupon usage tracking after order creation:
```typescript
// After order insert succeeds
if (appliedCoupon) {
  // Track coupon usage
  await supabase.from('coupon_usage').insert({
    coupon_id: appliedCoupon.id,
    user_id: user.id,
    order_id: order.id
  });

  // Increment used count
  await supabase.from('coupons')
    .update({ used_count: appliedCoupon.used_count + 1 })
    .eq('id', appliedCoupon.id);
}
```

## Step 4: Add TagIcon import to AdminDashboard
```typescript
import { TagIcon } from '@heroicons/react/24/outline';
```

## Step 5: Test the System

1. **Create a test coupon in admin:**
   - Code: TEST10
   - Type: Percentage
   - Value: 10
   
2. **Place a test order:**
   - Enter coupon code TEST10
   - Click Apply
   - Verify discount is applied
   - Complete payment
   - Verify order has coupon data

## Files Created:
- ✅ `database/create_coupons_system.sql`
- ✅ `src/components/CouponManagement.tsx`

## Files to Modify:
- `src/pages/OrderPage.tsx` (extensive changes above)
- `src/pages/AdminDashboard.tsx` (add Coupons tab)

## Database Tables Created:
- `coupons` - Stores coupon definitions
- `coupon_usage` - Tracks per-user coupon usage

## Database Columns Added to Orders:
- `coupon_id` - Reference to coupon used
- `coupon_code` - Copy of coupon code
- `original_amount` - Pre-discount amount
- `discount_amount` - Amount discounted

