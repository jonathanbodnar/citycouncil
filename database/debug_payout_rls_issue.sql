-- Debug script to identify the RLS issue with payouts

-- 1. Check if RLS is enabled on payouts
SELECT 
    '1. RLS STATUS' AS section,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'payouts';

-- 2. Check all current policies on payouts
SELECT 
    '2. CURRENT POLICIES' AS section,
    policyname,
    cmd AS command,
    roles,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies 
WHERE tablename = 'payouts'
ORDER BY policyname;

-- 3. Check the trigger function definition
SELECT 
    '3. TRIGGER FUNCTION SECURITY' AS section,
    proname AS function_name,
    prosecdef AS is_security_definer,
    proowner::regrole AS function_owner
FROM pg_proc
WHERE proname = 'create_payout_on_order_completion';

-- 4. Check what role/user the trigger runs as
SELECT 
    '4. TRIGGER DETAILS' AS section,
    tgname AS trigger_name,
    tgenabled AS enabled,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname = 'trigger_create_payout_on_completion';

-- 5. Test if we can manually insert a payout (this will fail with RLS error if blocked)
-- DO $$
-- BEGIN
--     INSERT INTO payouts (
--         talent_id,
--         order_id,
--         order_amount,
--         admin_fee_percentage,
--         admin_fee_amount,
--         payout_amount,
--         status,
--         week_start_date,
--         week_end_date
--     ) VALUES (
--         (SELECT id FROM talent_profiles LIMIT 1),
--         'test-order-id-' || NOW()::text,
--         10000,
--         25,
--         2500,
--         7500,
--         'pending',
--         CURRENT_DATE,
--         CURRENT_DATE + 7
--     );
--     RAISE NOTICE '✅ Manual insert succeeded';
-- EXCEPTION WHEN OTHERS THEN
--     RAISE NOTICE '❌ Manual insert failed: %', SQLERRM;
--     ROLLBACK;
-- END $$;

-- 6. Check grants on payouts table
SELECT 
    '6. TABLE GRANTS' AS section,
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name = 'payouts'
ORDER BY grantee, privilege_type;

SELECT '✅ Diagnostic complete. Review the output above.' AS status;

