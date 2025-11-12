-- Find short link for a specific fulfillment token

-- First, find the order ID from the fulfillment token
SELECT 
  o.id as order_id,
  o.fulfillment_token,
  sl.short_code,
  sl.long_url,
  CASE 
    WHEN sl.short_code IS NOT NULL THEN CONCAT('https://shoutout.us/s/', sl.short_code)
    ELSE 'No short link found'
  END as short_link,
  sl.created_at as short_link_created_at
FROM orders o
LEFT JOIN short_links sl ON sl.order_id = o.id
WHERE o.fulfillment_token = '76c0b4b955cb41899c7f21db49ba88ab7a1dafc9c60d484303376f597ce17e4e';

-- Also check if magic_auth_token exists for this order
SELECT 
  'Magic Token Status' as info,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM magic_auth_tokens mat
      JOIN orders o ON mat.order_id = o.id
      WHERE o.fulfillment_token = '76c0b4b955cb41899c7f21db49ba88ab7a1dafc9c60d484303376f597ce17e4e'
        AND mat.expires_at > NOW()
        AND mat.used_at IS NULL
    ) THEN 'Valid magic token exists'
    ELSE 'No valid magic token'
  END as status;

