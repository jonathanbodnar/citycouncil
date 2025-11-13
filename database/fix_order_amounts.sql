-- Fix order amounts that are stored 100x too high
-- Root cause: Orders are being created with amounts like $5000 instead of $50

-- 1. First, let's see which orders have suspiciously high amounts (over $1000)
SELECT 
    o.id,
    SUBSTRING(o.id::text, 1, 8) as order_short_id,
    tp.username,
    o.amount as current_amount,
    ROUND(o.amount / 100, 2) as corrected_amount,
    o.status,
    o.created_at::date as order_date
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.amount > 1000 -- Suspiciously high (over $1000)
ORDER BY o.amount DESC;

-- 2. Fix the orders table - divide amounts by 100 for orders over $1000
UPDATE orders
SET 
    amount = ROUND(amount / 100, 2),
    updated_at = NOW()
WHERE amount > 1000;

-- 3. Now we need to recalculate payouts based on corrected order amounts
-- Truncate and rebuild payouts with correct order amounts
TRUNCATE TABLE payouts CASCADE;
TRUNCATE TABLE payout_batches CASCADE;

-- Reset total_earnings for all talent
UPDATE talent_profiles
SET total_earnings = 0;

-- 4. Manually recalculate payouts for all completed orders
-- This uses the manual function we created earlier
DO $$
DECLARE
  order_record RECORD;
BEGIN
  FOR order_record IN 
    SELECT id, talent_id, amount, status, updated_at, video_url
    FROM orders
    WHERE status = 'completed'
    AND video_url IS NOT NULL
    AND video_url != ''
    ORDER BY updated_at ASC -- Process in chronological order
  LOOP
    PERFORM create_payout_on_order_completion_manual(
      order_record.id,
      order_record.talent_id,
      order_record.amount,
      order_record.updated_at
    );
  END LOOP;
END $$;

-- 5. Verify the corrections
-- Show corrected order amounts
SELECT 
    tp.username,
    SUBSTRING(o.id::text, 1, 8) as order_short_id,
    o.amount as order_amount,
    o.status,
    o.created_at::date as order_date
FROM orders o
JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE tp.username IN ('shawnfarash', 'joshfirestine', 'jonathanbodnar', 'geraldmorgan')
ORDER BY tp.username, o.created_at ASC;

-- Show corrected payout amounts
SELECT 
    tp.username,
    SUBSTRING(o.id::text, 1, 8) as order_short_id,
    p.order_amount,
    p.admin_fee_percentage,
    p.admin_fee_amount,
    p.payout_amount,
    p.week_start_date,
    p.created_at::date as payout_date
FROM payouts p
JOIN talent_profiles tp ON tp.id = p.talent_id
JOIN orders o ON o.id = p.order_id
WHERE tp.username IN ('shawnfarash', 'joshfirestine', 'jonathanbodnar', 'geraldmorgan')
ORDER BY tp.username, p.created_at ASC;

-- Show updated batch totals
SELECT 
    tp.username,
    tp.fulfilled_orders,
    tp.total_earnings,
    pb.week_start_date,
    pb.total_orders as orders_in_batch,
    pb.total_payout_amount,
    pb.net_payout_amount
FROM talent_profiles tp
JOIN payout_batches pb ON pb.talent_id = tp.id
WHERE tp.username IN ('shawnfarash', 'joshfirestine', 'jonathanbodnar', 'geraldmorgan')
ORDER BY tp.username, pb.week_start_date DESC;

