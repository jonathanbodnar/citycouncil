-- Fix Mark Walker's order amount
-- Current: 115.76000000000000 (stored as dollars, should be 11576 cents)
-- Order ID: b30b-b3a6-b507e9d6cf46

-- First, check the current value
SELECT 
  id,
  amount,
  amount / 100.0 as amount_in_dollars_if_cents,
  status,
  created_at
FROM orders
WHERE id = 'b30b-b3a6-b507e9d6cf46';

-- Update the amount to be in cents (multiply by 100)
UPDATE orders
SET amount = 11576  -- $115.76 in cents
WHERE id = 'b30b-b3a6-b507e9d6cf46';

-- Verify the fix
SELECT 
  id,
  amount,
  amount / 100.0 as amount_in_dollars,
  status,
  created_at
FROM orders
WHERE id = 'b30b-b3a6-b507e9d6cf46';

