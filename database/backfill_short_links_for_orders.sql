-- Backfill short links for all existing orders that don't have them
-- This will create short links for orders so admin can copy shorter fulfillment URLs

DO $$
DECLARE
  v_order RECORD;
  v_short_code TEXT;
  v_long_url TEXT;
  v_base_url TEXT := 'https://shoutout.us'; -- Change if needed
  v_token TEXT;
  v_created_count INT := 0;
BEGIN
  RAISE NOTICE '🔗 Starting short link backfill for existing orders...';
  
  -- Loop through all orders that don't have a short link yet
  FOR v_order IN 
    SELECT o.id, o.fulfillment_token, tp.user_id
    FROM orders o
    JOIN talent_profiles tp ON o.talent_id = tp.id
    WHERE o.fulfillment_token IS NOT NULL
      AND o.order_type IS DISTINCT FROM 'demo' -- Exclude demo orders
      AND NOT EXISTS (
        SELECT 1 FROM short_links sl WHERE sl.order_id = o.id
      )
    ORDER BY o.created_at DESC
  LOOP
    -- Check if magic_auth_token exists for this order
    SELECT token INTO v_token
    FROM magic_auth_tokens
    WHERE order_id = v_order.id
      AND expires_at > NOW()
      AND used_at IS NULL
    LIMIT 1;

    -- If no magic token exists, create one
    IF v_token IS NULL THEN
      v_token := public.generate_unique_magic_token();
      
      INSERT INTO magic_auth_tokens (user_id, order_id, token, expires_at)
      VALUES (v_order.user_id, v_order.id, v_token, NOW() + INTERVAL '90 days');
      
      RAISE NOTICE '  ✅ Created magic token for order %', v_order.id;
    END IF;

    -- Build the long URL with magic auth token
    v_long_url := v_base_url || '/fulfill/' || v_order.fulfillment_token || '?auth=' || v_token;

    -- Generate unique short code
    v_short_code := public.generate_unique_short_code(6);

    -- Insert short link
    INSERT INTO short_links (short_code, long_url, order_id, user_id, expires_at)
    VALUES (
      v_short_code,
      v_long_url,
      v_order.id,
      v_order.user_id,
      NOW() + INTERVAL '90 days'
    );

    v_created_count := v_created_count + 1;
    
    IF v_created_count % 10 = 0 THEN
      RAISE NOTICE '  📊 Progress: % short links created...', v_created_count;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Short link backfill complete!';
  RAISE NOTICE '📊 Created % short links for existing orders', v_created_count;
  RAISE NOTICE '';
END $$;

-- Verify the results
SELECT 
  'Total Orders' AS metric,
  COUNT(*) AS count
FROM orders
WHERE fulfillment_token IS NOT NULL
  AND order_type IS DISTINCT FROM 'demo'

UNION ALL

SELECT 
  'Orders with Short Links' AS metric,
  COUNT(DISTINCT order_id) AS count
FROM short_links
WHERE order_id IS NOT NULL

UNION ALL

SELECT 
  'Orders without Short Links' AS metric,
  COUNT(*) AS count
FROM orders o
WHERE o.fulfillment_token IS NOT NULL
  AND o.order_type IS DISTINCT FROM 'demo'
  AND NOT EXISTS (
    SELECT 1 FROM short_links sl WHERE sl.order_id = o.id
  );

