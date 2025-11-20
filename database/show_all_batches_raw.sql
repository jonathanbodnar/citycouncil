-- Show absolutely ALL batch records in the database
SELECT 
    COUNT(*) as total_batch_records
FROM payout_batches;

-- Show every single batch record
SELECT 
    pb.id,
    pb.talent_id,
    tp.username,
    pb.week_start_date,
    pb.week_end_date,
    pb.total_orders,
    pb.net_payout_amount,
    pb.status,
    pb.created_at
FROM payout_batches pb
LEFT JOIN talent_profiles tp ON tp.id = pb.talent_id
ORDER BY pb.created_at DESC;

