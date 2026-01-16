-- List of talent with pending payouts but no Moov account
-- THIS WILL SHOW THE ACTUAL LIST OF NAMES

-- First, create a temp table to bypass any RLS issues
DO $$
DECLARE
  r RECORD;
  v_total_talent INT := 0;
  v_total_amount DECIMAL := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE 'TALENT WITH PENDING PAYOUTS - NO MOOV ACCOUNT';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Username | Name | Email | Phone | Amount Owed | Weeks';
  RAISE NOTICE '------------------------------------------------------------------------';
  
  FOR r IN
    SELECT 
      tp.username,
      COALESCE(tp.temp_full_name, tp.username) as talent_name,
      u.email,
      COALESCE(u.phone, 'No phone') as phone,
      COUNT(pb.id) as pending_batches,
      ROUND(SUM(pb.net_payout_amount), 2) as total_amount_owed,
      MIN(pb.week_start_date) as oldest_week,
      MAX(pb.week_end_date) as newest_week
    FROM talent_profiles tp
    JOIN users u ON u.id = tp.user_id
    JOIN payout_batches pb ON pb.talent_id = tp.id
    WHERE pb.status = 'pending'
      AND tp.moov_account_id IS NULL
    GROUP BY tp.id, tp.username, tp.temp_full_name, u.email, u.phone
    ORDER BY total_amount_owed DESC
  LOOP
    RAISE NOTICE '% | % | % | % | $% | % to %', 
      r.username, 
      r.talent_name, 
      r.email, 
      r.phone,
      r.total_amount_owed,
      r.oldest_week,
      r.newest_week;
    
    v_total_talent := v_total_talent + 1;
    v_total_amount := v_total_amount + r.total_amount_owed;
  END LOOP;
  
  RAISE NOTICE '------------------------------------------------------------------------';
  RAISE NOTICE '';
  RAISE NOTICE '📊 SUMMARY:';
  RAISE NOTICE 'Total Talent: %', v_total_talent;
  RAISE NOTICE 'Total Amount Owed: $%', ROUND(v_total_amount, 2);
  RAISE NOTICE '';
  RAISE NOTICE '📧 ACTION: Email these talent to complete payout setup at:';
  RAISE NOTICE 'https://shoutout.us/dashboard (Settings > Payout Setup)';
  RAISE NOTICE '';
  RAISE NOTICE '========================================================================';
  RAISE NOTICE '';
END $$;
