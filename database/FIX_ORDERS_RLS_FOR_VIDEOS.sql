-- Fix RLS policy on orders table to allow reading video_url for homepage
-- The issue: When a user is logged in, RLS might restrict which orders they can see
-- We need to allow reading public video data (video_url, talent_id, occasion) for all users

-- First, let's check existing policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'orders';

-- Add a policy to allow reading orders with videos for homepage display
-- This allows anyone (authenticated or anonymous) to read basic order info
-- for orders that have videos (for the public homepage)

-- Drop existing read policy if it's too restrictive
-- DROP POLICY IF EXISTS "Allow reading orders with videos for homepage" ON orders;

-- Create a new policy that allows reading orders with videos
CREATE POLICY "Allow reading orders with videos for homepage" ON orders
FOR SELECT
TO public
USING (
    video_url IS NOT NULL -- Only orders with videos
);

-- Alternative: If you want to be more restrictive, you can limit to only certain columns
-- But Supabase doesn't support column-level RLS, so we'd need a view

-- OPTION 2: Create a view that bypasses RLS
-- This is a cleaner solution if you want to limit what's exposed

DROP VIEW IF EXISTS public_order_videos;

CREATE VIEW public_order_videos AS
SELECT 
    id,
    talent_id,
    video_url,
    occasion,
    completed_at,
    status
FROM orders
WHERE video_url IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON public_order_videos TO anon, authenticated;

-- Make the view bypass RLS (SECURITY DEFINER)
-- ALTER VIEW public_order_videos SET (security_invoker = false);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
