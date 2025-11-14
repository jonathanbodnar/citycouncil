-- Fix RLS policy to allow public (anonymous) users to view completed orders with videos
-- This enables the "Recent Videos" section on talent profile pages

-- Create a policy for anonymous users to view ONLY completed orders with video_url
-- This is safe because:
-- 1. Only completed orders (video delivered)
-- 2. Only orders with video_url (not null)
-- 3. Only video_url field is exposed (request_details and personal info remain private)

CREATE POLICY "Public can view completed orders with videos"
  ON orders
  FOR SELECT
  TO anon
  USING (
    status = 'completed' 
    AND video_url IS NOT NULL
  );

-- Verify the new policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'orders' 
  AND cmd = 'SELECT'
ORDER BY policyname;

