-- Check orders with odd cents (not .00, .01) - likely have processing fee artifacts
-- These should be clean dollar amounts after removing processing fee

SELECT 
    tp.username as talent,
    o.id as order_id,
    o.amount as raw_cents,
    (o.amount / 100.0) as raw_dollars,
    -- Current calculation (with /1.029):
    (o.amount / 100.0 / 1.029) as current_base_price,
    -- What it SHOULD be (rounded to nearest dollar or .50):
    ROUND((o.amount / 100.0 / 1.029) * 2) / 2 as expected_base_price,
    -- Check if it looks like a clean price:
    CASE 
        WHEN (o.amount / 100.0 / 1.029)::numeric(10,2) = ROUND((o.amount / 100.0 / 1.029) * 2) / 2 THEN '✅ Clean'
        ELSE '❌ Has artifact - raw amount: $' || (o.amount / 100.0)::text
    END as status,
    -- What the payout shows:
    p.order_amount as payout_order_amount,
    p.payout_amount as payout_amount,
    o.created_at::date
FROM orders o
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
LEFT JOIN payouts p ON p.order_id = o.id
WHERE o.status = 'completed'
  -- Find orders with odd cents (not .00 or .01)
  AND ((o.amount / 100.0 / 1.029)::numeric(10,2))::text NOT LIKE '%.00'
  AND ((o.amount / 100.0 / 1.029)::numeric(10,2))::text NOT LIKE '%.01'
ORDER BY tp.username, o.created_at DESC;

-- Also show what these orders.amount values are in cents
SELECT 
    tp.username,
    o.id,
    o.amount as stored_cents,
    'If base price was $' || ROUND((o.amount / 100.0 / 1.029)) || ', cents should be: ' || (ROUND((o.amount / 100.0 / 1.029)) * 1.029 * 100)::int as what_it_should_be
FROM orders o
LEFT JOIN talent_profiles tp ON tp.id = o.talent_id
WHERE o.status = 'completed'
  AND ((o.amount / 100.0 / 1.029)::numeric(10,2))::text NOT LIKE '%.00'
  AND ((o.amount / 100.0 / 1.029)::numeric(10,2))::text NOT LIKE '%.01'
ORDER BY tp.username;

