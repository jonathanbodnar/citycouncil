-- Add blocked availability system for talent profiles

-- Create blocked_availability table to store date ranges when talent is unavailable
CREATE TABLE IF NOT EXISTS blocked_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    talent_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT, -- Optional reason for blocking (vacation, personal, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_blocked_availability_talent_id ON blocked_availability(talent_id);
CREATE INDEX IF NOT EXISTS idx_blocked_availability_dates ON blocked_availability(start_date, end_date);

-- Enable RLS
ALTER TABLE blocked_availability ENABLE ROW LEVEL SECURITY;

-- Policy: Talent can manage their own blocked dates
CREATE POLICY "Talent can manage own blocked availability" ON blocked_availability
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM talent_profiles
    WHERE talent_profiles.id = blocked_availability.talent_id
    AND talent_profiles.user_id = auth.uid()
  )
);

-- Policy: Public can view blocked dates (to check availability)
CREATE POLICY "Public can view blocked availability" ON blocked_availability
FOR SELECT
TO anon, authenticated
USING (true);

-- Create function to check if talent is currently blocked/unavailable
CREATE OR REPLACE FUNCTION is_talent_currently_unavailable(talent_profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM blocked_availability
    WHERE talent_id = talent_profile_id
    AND CURRENT_DATE >= start_date
    AND CURRENT_DATE <= end_date
  );
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blocked_availability_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blocked_availability_timestamp
  BEFORE UPDATE ON blocked_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_blocked_availability_updated_at();

-- Add comments for documentation
COMMENT ON TABLE blocked_availability IS 'Stores date ranges when talent is unavailable for orders';
COMMENT ON COLUMN blocked_availability.talent_id IS 'Reference to talent_profiles';
COMMENT ON COLUMN blocked_availability.start_date IS 'First date of unavailability (inclusive)';
COMMENT ON COLUMN blocked_availability.end_date IS 'Last date of unavailability (inclusive)';
COMMENT ON COLUMN blocked_availability.reason IS 'Optional reason for being unavailable (vacation, personal, etc.)';
COMMENT ON FUNCTION is_talent_currently_unavailable(UUID) IS 'Returns true if talent has active blocked dates covering today';

