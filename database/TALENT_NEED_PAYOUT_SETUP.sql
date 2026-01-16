-- Show which talent have pending payouts but haven't set up Moov accounts
-- Use this to contact them and get them to complete payout onboarding

SELECT 
  '❌ TALENT WITHOUT MOOV ACCOUNTS' as section,
  tp.username,
  COALESCE(tp.temp_full_name, tp.username) as talent_name,
  u.email,
  u.phone,
  COUNT(pb.id) as pending_batches,
  SUM(pb.net_payout_amount) as total_owed,
  MIN(pb.week_start_date) as oldest_unpaid_week,
  tp.payout_onboarding_step as current_step,
  CASE 
    WHEN tp.payout_onboarding_step = 0 THEN 'Haven''t started setup'
    WHEN tp.payout_onboarding_step = 1 THEN 'Started but incomplete'
    WHEN tp.payout_onboarding_step = 2 THEN 'In progress'
    WHEN tp.payout_onboarding_step = 3 THEN 'Nearly complete'
    ELSE 'Unknown step ' || tp.payout_onboarding_step
  END as setup_status
FROM talent_profiles tp
JOIN users u ON u.id = tp.user_id
JOIN payout_batches pb ON pb.talent_id = tp.id
WHERE pb.status = 'pending'
  AND tp.moov_account_id IS NULL
GROUP BY tp.id, tp.username, tp.temp_full_name, u.email, u.phone, tp.payout_onboarding_step
ORDER BY total_owed DESC;

-- Summary
DO $$
DECLARE
  v_count INT;
  v_total_owed DECIMAL;
BEGIN
  SELECT 
    COUNT(DISTINCT tp.id),
    SUM(pb.net_payout_amount)
  INTO v_count, v_total_owed
  FROM talent_profiles tp
  JOIN payout_batches pb ON pb.talent_id = tp.id
  WHERE pb.status = 'pending'
    AND tp.moov_account_id IS NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '📧 CONTACT THESE TALENT';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE '% talent need to complete payout setup', v_count;
  RAISE NOTICE 'Total amount waiting: $%', v_total_owed;
  RAISE NOTICE '';
  RAISE NOTICE 'ACTION: Send them an email/SMS with link to:';
  RAISE NOTICE 'https://shoutout.us/dashboard (Settings > Payout Setup)';
  RAISE NOTICE '';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
END $$;

-- Also show the 7 that ARE ready (for comparison)
SELECT 
  '✅ TALENT READY TO BE PAID' as section,
  tp.username,
  COALESCE(tp.temp_full_name, tp.username) as talent_name,
  COUNT(pb.id) as ready_batches,
  SUM(pb.net_payout_amount) as total_amount,
  MIN(pb.week_start_date) as oldest_week
FROM talent_profiles tp
JOIN payout_batches pb ON pb.talent_id = tp.id
WHERE pb.status = 'pending'
  AND tp.moov_account_id IS NOT NULL
  AND tp.bank_account_linked = true
  AND tp.payout_onboarding_completed = true
  AND (pb.needs_review = false OR pb.needs_review IS NULL)
GROUP BY tp.id, tp.username, tp.temp_full_name
ORDER BY total_amount DESC;
