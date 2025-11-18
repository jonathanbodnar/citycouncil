-- Fix W-9 RLS Policy - Remove Infinite Recursion
-- The INSERT policy was checking if a W-9 exists, which creates recursion

-- Drop the problematic policies
DROP POLICY IF EXISTS "Talent can insert own W-9" ON w9_forms;

-- Recreate the INSERT policy WITHOUT the recursion
-- Remove the "NOT EXISTS" check - we'll handle duplicates in the edge function
CREATE POLICY "Talent can insert own W-9"
    ON w9_forms FOR INSERT
    WITH CHECK (
        talent_id IN (
            SELECT id FROM talent_profiles WHERE user_id = auth.uid()
        )
    );

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'w9_forms';

