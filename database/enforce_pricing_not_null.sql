-- Enforce NOT NULL constraint on pricing columns for all talent profiles
-- This prevents future NULL pricing issues

DO $$
DECLARE
    default_pricing NUMERIC := 150.00;
    default_corporate_pricing NUMERIC := 225.00;
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== ENFORCING PRICING NOT NULL CONSTRAINT ===';
    RAISE NOTICE '';

    -- Step 1: Update ONLY talents with NULL pricing (don't touch existing pricing)
    RAISE NOTICE '📋 Step 1: Checking for talents with NULL pricing...';
    
    WITH null_pricing_talents AS (
        SELECT 
            tp.id,
            u.full_name,
            tp.pricing,
            tp.corporate_pricing
        FROM talent_profiles tp
        LEFT JOIN users u ON tp.user_id = u.id
        WHERE tp.pricing IS NULL OR tp.corporate_pricing IS NULL
    )
    SELECT COUNT(*) INTO updated_count FROM null_pricing_talents;
    
    IF updated_count > 0 THEN
        RAISE NOTICE '⚠️  Found % talent(s) with NULL pricing', updated_count;
        
        -- Show which talents will be updated
        FOR rec IN (
            SELECT 
                tp.id,
                COALESCE(u.full_name, tp.temp_full_name, 'Unknown') as name,
                tp.pricing,
                tp.corporate_pricing
            FROM talent_profiles tp
            LEFT JOIN users u ON tp.user_id = u.id
            WHERE tp.pricing IS NULL OR tp.corporate_pricing IS NULL
        )
        LOOP
            RAISE NOTICE '   - % (ID: %): pricing=%, corporate_pricing=%', 
                rec.name, rec.id, 
                COALESCE(rec.pricing::TEXT, 'NULL'),
                COALESCE(rec.corporate_pricing::TEXT, 'NULL');
        END LOOP;
        
        RAISE NOTICE '';
        RAISE NOTICE '🔧 Updating NULL pricing values to defaults...';
        
        -- Update only NULL values
        UPDATE talent_profiles
        SET 
            pricing = COALESCE(pricing, default_pricing),
            corporate_pricing = COALESCE(corporate_pricing, default_corporate_pricing),
            updated_at = NOW()
        WHERE pricing IS NULL OR corporate_pricing IS NULL;
        
        RAISE NOTICE '✅ Updated % talent profile(s) with default pricing', updated_count;
        RAISE NOTICE '   Default pricing: $%, Corporate: $%', default_pricing, default_corporate_pricing;
    ELSE
        RAISE NOTICE '✅ All talents already have pricing set. No updates needed.';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 Step 2: Adding NOT NULL constraint to pricing columns...';
    
    -- Step 2: Add NOT NULL constraint with default values
    -- First check if constraint already exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' 
        AND column_name = 'pricing' 
        AND is_nullable = 'NO'
    ) THEN
        RAISE NOTICE 'ℹ️  NOT NULL constraint already exists on pricing column';
    ELSE
        -- Set default and add NOT NULL constraint
        ALTER TABLE talent_profiles 
        ALTER COLUMN pricing SET DEFAULT 150.00;
        
        ALTER TABLE talent_profiles 
        ALTER COLUMN pricing SET NOT NULL;
        
        RAISE NOTICE '✅ Added NOT NULL constraint to pricing column (default: $150.00)';
    END IF;
    
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'talent_profiles' 
        AND column_name = 'corporate_pricing' 
        AND is_nullable = 'NO'
    ) THEN
        RAISE NOTICE 'ℹ️  NOT NULL constraint already exists on corporate_pricing column';
    ELSE
        -- Set default and add NOT NULL constraint
        ALTER TABLE talent_profiles 
        ALTER COLUMN corporate_pricing SET DEFAULT 225.00;
        
        ALTER TABLE talent_profiles 
        ALTER COLUMN corporate_pricing SET NOT NULL;
        
        RAISE NOTICE '✅ Added NOT NULL constraint to corporate_pricing column (default: $225.00)';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== ✅ PRICING ENFORCEMENT COMPLETE ===';
    RAISE NOTICE 'All current talents have pricing set.';
    RAISE NOTICE 'Future talent profiles will require pricing (cannot be NULL).';
    RAISE NOTICE '';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error enforcing pricing constraints: %', SQLERRM;
END $$;

-- Verify the changes
SELECT 
    '=== VERIFICATION ===' as status,
    COUNT(*) as total_talents,
    COUNT(*) FILTER (WHERE pricing IS NOT NULL) as have_pricing,
    COUNT(*) FILTER (WHERE corporate_pricing IS NOT NULL) as have_corporate_pricing,
    COUNT(*) FILTER (WHERE pricing IS NULL OR corporate_pricing IS NULL) as still_null
FROM talent_profiles;

-- Show column constraints after update
SELECT 
    '=== COLUMN CONSTRAINTS ===' as status,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'talent_profiles'
  AND column_name IN ('pricing', 'corporate_pricing')
ORDER BY column_name;

