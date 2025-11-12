-- Add batch processing logic with admin pause control and Moov/Plaid requirements

-- 1. Function to check if talent is ready for payouts
CREATE OR REPLACE FUNCTION is_talent_payout_ready(p_talent_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_moov_account_id VARCHAR;
  v_has_bank_account BOOLEAN;
BEGIN
  -- Check if talent has Moov account
  SELECT moov_account_id INTO v_moov_account_id
  FROM talent_profiles
  WHERE id = p_talent_id;
  
  IF v_moov_account_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- In production, you would check if they have a linked bank account via Moov API
  -- For now, we assume if they have moov_account_id, they're ready
  -- This can be enhanced by storing bank_account_linked flag on talent_profiles
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to get processable batches (respects admin pause + talent readiness)
CREATE OR REPLACE FUNCTION get_processable_payout_batches()
RETURNS TABLE(
  batch_id UUID,
  talent_id UUID,
  talent_username VARCHAR,
  talent_moov_account_id VARCHAR,
  week_start_date DATE,
  week_end_date DATE,
  net_payout_amount DECIMAL,
  total_orders INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pb.id as batch_id,
    pb.talent_id,
    tp.username as talent_username,
    tp.moov_account_id as talent_moov_account_id,
    pb.week_start_date,
    pb.week_end_date,
    pb.net_payout_amount,
    pb.total_orders
  FROM payout_batches pb
  JOIN talent_profiles tp ON tp.id = pb.talent_id
  WHERE pb.status = 'pending'
    AND pb.net_payout_amount > 0
    AND tp.moov_account_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM platform_settings 
      WHERE setting_key = 'payouts_enabled' 
      AND setting_value = 'true'
    )
  ORDER BY pb.week_start_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to mark batch as processing (called when sending to Moov)
CREATE OR REPLACE FUNCTION mark_batch_processing(
  p_batch_id UUID,
  p_moov_transfer_id VARCHAR DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE payout_batches
  SET 
    status = 'processing',
    moov_transfer_id = COALESCE(p_moov_transfer_id, moov_transfer_id),
    processed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_batch_id;
  
  -- Also update individual payouts in this batch
  UPDATE payouts
  SET 
    status = 'processing',
    batch_id = p_batch_id,
    updated_at = NOW()
  WHERE talent_id = (SELECT talent_id FROM payout_batches WHERE id = p_batch_id)
    AND week_start_date = (SELECT week_start_date FROM payout_batches WHERE id = p_batch_id)
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to mark batch as paid (called when Moov confirms)
CREATE OR REPLACE FUNCTION mark_batch_paid(
  p_batch_id UUID,
  p_moov_transfer_status VARCHAR DEFAULT 'completed'
)
RETURNS VOID AS $$
BEGIN
  UPDATE payout_batches
  SET 
    status = 'paid',
    moov_transfer_status = p_moov_transfer_status,
    updated_at = NOW()
  WHERE id = p_batch_id;
  
  -- Also update individual payouts
  UPDATE payouts
  SET 
    status = 'paid',
    updated_at = NOW()
  WHERE batch_id = p_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to mark batch as failed (called if Moov fails)
CREATE OR REPLACE FUNCTION mark_batch_failed(
  p_batch_id UUID,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE payout_batches
  SET 
    status = 'failed',
    moov_transfer_status = 'failed',
    updated_at = NOW()
  WHERE id = p_batch_id;
  
  -- Reset individual payouts to pending so they can be retried
  UPDATE payouts
  SET 
    status = 'pending',
    batch_id = NULL,
    updated_at = NOW()
  WHERE batch_id = p_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger to process pending batches when Moov account is activated
CREATE OR REPLACE FUNCTION process_pending_batches_on_moov_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- When a talent gets a moov_account_id and payouts are enabled
  IF NEW.moov_account_id IS NOT NULL AND (OLD.moov_account_id IS NULL OR OLD.moov_account_id != NEW.moov_account_id) THEN
    
    -- Check if payouts are enabled globally
    IF EXISTS (
      SELECT 1 FROM platform_settings 
      WHERE setting_key = 'payouts_enabled' 
      AND setting_value = 'true'
    ) THEN
      
      -- Mark all pending batches for this talent as ready for processing
      -- This doesn't automatically send to Moov, but flags them as processable
      UPDATE payout_batches
      SET updated_at = NOW()
      WHERE talent_id = NEW.id
        AND status = 'pending'
        AND net_payout_amount > 0;
        
      -- You could also insert a notification here to alert admin
      -- that a talent just activated Moov and has pending payouts
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_moov_activation_process_batches ON public.talent_profiles;
CREATE TRIGGER on_moov_activation_process_batches
  AFTER UPDATE ON public.talent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION process_pending_batches_on_moov_activation();

-- 7. Helper function to get batch summary for a talent
CREATE OR REPLACE FUNCTION get_talent_pending_batch_summary(p_talent_id UUID)
RETURNS TABLE(
  total_pending_batches INTEGER,
  total_pending_amount DECIMAL,
  oldest_batch_date DATE,
  is_moov_ready BOOLEAN,
  payouts_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_pending_batches,
    COALESCE(SUM(pb.net_payout_amount), 0) as total_pending_amount,
    MIN(pb.week_start_date) as oldest_batch_date,
    (tp.moov_account_id IS NOT NULL) as is_moov_ready,
    EXISTS(SELECT 1 FROM platform_settings WHERE setting_key = 'payouts_enabled' AND setting_value = 'true') as payouts_enabled
  FROM payout_batches pb
  JOIN talent_profiles tp ON tp.id = pb.talent_id
  WHERE pb.talent_id = p_talent_id
    AND pb.status = 'pending'
  GROUP BY tp.moov_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add bank_account_linked flag to talent_profiles (optional enhancement)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'talent_profiles' 
    AND column_name = 'bank_account_linked'
  ) THEN
    ALTER TABLE public.talent_profiles 
    ADD COLUMN bank_account_linked BOOLEAN DEFAULT FALSE;
    
    COMMENT ON COLUMN talent_profiles.bank_account_linked IS 
      'Set to TRUE after Plaid successfully links a bank account';
  END IF;
END $$;

-- 9. View for admin to see all processable batches
CREATE OR REPLACE VIEW admin_processable_batches AS
SELECT 
  pb.id as batch_id,
  pb.talent_id,
  tp.username as talent_username,
  COALESCE(u.full_name, tp.temp_full_name) as talent_name,
  tp.moov_account_id,
  tp.bank_account_linked,
  pb.week_start_date,
  pb.week_end_date,
  pb.total_orders,
  pb.net_payout_amount,
  pb.status,
  pb.moov_transfer_id,
  pb.created_at,
  CASE 
    WHEN tp.moov_account_id IS NULL THEN 'Moov account not created'
    WHEN tp.bank_account_linked = FALSE THEN 'Bank account not linked'
    WHEN NOT EXISTS(SELECT 1 FROM platform_settings WHERE setting_key = 'payouts_enabled' AND setting_value = 'true') 
      THEN 'Payouts paused by admin'
    ELSE 'Ready to process'
  END as processing_status
FROM payout_batches pb
JOIN talent_profiles tp ON tp.id = pb.talent_id
LEFT JOIN users u ON u.id = tp.user_id
WHERE pb.status = 'pending'
ORDER BY 
  CASE 
    WHEN tp.moov_account_id IS NOT NULL AND tp.bank_account_linked = TRUE THEN 0
    ELSE 1
  END,
  pb.week_start_date ASC;

SELECT '✅ Batch processing logic added!' AS result;
SELECT 'Functions: get_processable_payout_batches(), mark_batch_processing(), mark_batch_paid(), mark_batch_failed()' AS info;
SELECT 'Trigger: on_moov_activation_process_batches - auto-flags batches when talent activates Moov' AS info;
SELECT 'View: admin_processable_batches - shows which batches are ready and why some aren''t' AS info;

