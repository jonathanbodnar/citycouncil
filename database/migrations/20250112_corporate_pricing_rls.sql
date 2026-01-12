-- RLS Policies for Corporate Pricing Feature
-- Ensures proper access control for the corporate_pricing field

-- Allow public SELECT of corporate_pricing (needed for order page)
-- This is already covered by existing talent_profiles SELECT policy, but let's verify it's correct

-- Verify existing SELECT policy allows corporate_pricing
-- The select policy should allow anyone to read talent profiles (including corporate_pricing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'talent_profiles' 
    AND policyname = 'Allow public to view active talent profiles'
  ) THEN
    -- Create public SELECT policy if it doesn't exist
    CREATE POLICY "Allow public to view active talent profiles"
      ON talent_profiles
      FOR SELECT
      TO public
      USING (is_active = true OR is_coming_soon = true);
  END IF;
END $$;

-- Update policy: Only talent can update their own corporate_pricing
-- Drop existing update policy if it exists and recreate with proper corporate_pricing access
DO $$
BEGIN
  -- Drop old policy if exists
  DROP POLICY IF EXISTS "Allow talent to update own profile" ON talent_profiles;
  
  -- Create new comprehensive update policy
  CREATE POLICY "Allow talent to update own profile"
    ON talent_profiles
    FOR UPDATE
    TO authenticated
    USING (
      auth.uid() = user_id 
      OR 
      EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.user_type = 'admin'
      )
    )
    WITH CHECK (
      auth.uid() = user_id 
      OR 
      EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.user_type = 'admin'
      )
    );
END $$;

-- Ensure orders table RLS allows corporate orders to be created
DO $$
BEGIN
  -- Verify orders INSERT policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'orders' 
    AND policyname = 'Allow authenticated users to create orders'
  ) THEN
    CREATE POLICY "Allow authenticated users to create orders"
      ON orders
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Verify orders SELECT policy allows users to see their own orders (including corporate fields)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'orders' 
    AND policyname = 'Allow users to view own orders'
  ) THEN
    CREATE POLICY "Allow users to view own orders"
      ON orders
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() = user_id 
        OR 
        auth.uid() IN (
          SELECT user_id FROM talent_profiles WHERE id = talent_id
        )
        OR
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() 
          AND users.user_type = 'admin'
        )
      );
  END IF;
END $$;

-- Verify orders UPDATE policy allows talent to update orders (for corporate approval)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'orders' 
    AND policyname = 'Allow talent to update orders for their profile'
  ) THEN
    CREATE POLICY "Allow talent to update orders for their profile"
      ON orders
      FOR UPDATE
      TO authenticated
      USING (
        auth.uid() IN (
          SELECT user_id FROM talent_profiles WHERE id = talent_id
        )
        OR
        auth.uid() = user_id
        OR
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() 
          AND users.user_type = 'admin'
        )
      )
      WITH CHECK (
        auth.uid() IN (
          SELECT user_id FROM talent_profiles WHERE id = talent_id
        )
        OR
        auth.uid() = user_id
        OR
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() 
          AND users.user_type = 'admin'
        )
      );
  END IF;
END $$;

-- Grant necessary permissions
GRANT SELECT ON talent_profiles TO anon, authenticated;
GRANT UPDATE (corporate_pricing, updated_at) ON talent_profiles TO authenticated;
GRANT INSERT, SELECT, UPDATE ON orders TO authenticated;

-- Add helpful comments
COMMENT ON COLUMN talent_profiles.corporate_pricing IS 'Corporate event ShoutOut pricing in dollars. NULL means not offering corporate events. Only talent and admins can update.';

-- Verify all policies are active
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename IN ('talent_profiles', 'orders')
ORDER BY tablename, policyname;

