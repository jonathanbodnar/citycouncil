-- Fix admin fee percentages to 25% for all talent
-- Based on check_admin_fees.sql results

-- Update juanitabroaddrick from 15% to 25%
UPDATE public.talent_profiles
SET 
  admin_fee_percentage = 25,
  updated_at = NOW()
WHERE username = 'juanitabroaddrick';

-- Verify the update
SELECT 
  username,
  COALESCE(u.full_name, tp.temp_full_name) as full_name,
  admin_fee_percentage,
  updated_at
FROM public.talent_profiles tp
LEFT JOIN public.users u ON u.id = tp.user_id
WHERE tp.username = 'juanitabroaddrick';

