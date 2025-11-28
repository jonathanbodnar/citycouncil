-- Create admin audit log table for tracking impersonation and other admin actions

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- e.g., 'impersonate_user', 'delete_user', 'modify_order'
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB, -- Additional context about the action
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON public.admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Create policy: Only admins can read audit logs
CREATE POLICY "Admins can read audit logs"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Create policy: Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
  ON public.admin_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- No UPDATE or DELETE policies - audit logs are immutable

COMMENT ON TABLE public.admin_audit_log IS 'Audit trail of admin actions for security and compliance';
COMMENT ON COLUMN public.admin_audit_log.action IS 'Type of action performed (impersonate_user, delete_user, etc)';
COMMENT ON COLUMN public.admin_audit_log.metadata IS 'Additional context in JSON format';

