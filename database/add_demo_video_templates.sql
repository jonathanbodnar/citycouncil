-- Create table for demo video request templates
CREATE TABLE IF NOT EXISTS demo_video_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_text TEXT NOT NULL,
  occasion VARCHAR(50),
  tone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add column to orders to track which template was used
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS demo_template_id UUID REFERENCES demo_video_templates(id);

-- Insert 30 diverse demo video request templates (realistic ShoutOut requests)
INSERT INTO demo_video_templates (request_text, occasion, tone) VALUES
  ('Help me roast my brother Jake for his 25th birthday. He thinks he''s a gym bro now but he can barely lift the toilet seat. Make it funny! (This is for a parody promo - embellish as much as possible)', 'birthday', 'roast'),
  ('Wish my mom Linda a Merry Christmas! She''s 67 and just learned how to text - finally! Make it heartfelt but tease her about those 10-minute voicemails. (Parody promo - have fun with it!)', 'holiday', 'pep-talk'),
  ('My roommate Sarah won''t stop talking about her NFTs. Please tell her they''re dead and she needs to get off Discord and find a real job. Make it funny! (Parody promo)', 'roast', 'roast'),
  ('Help me break up with my boyfriend Tim. Let him down gently - he''s nice but the spark is gone. Can you do it for me? (Parody promo - make it awkward and funny)', 'advice', 'advice'),
  ('Roast my best friend for never replying to my texts. Like dude, I know you saw them. Make it savage! (Parody promo)', 'roast', 'roast'),
  ('My dad is having a midlife crisis. He bought a motorcycle and grew a beard. Tell him his wife is NOT into it. (Parody promo - be funny about it)', 'advice', 'roast'),
  ('Wish my sister Emma happy 30th birthday and roast her for still living with our parents. She needs to hear it! (Parody promo)', 'birthday', 'roast'),
  ('Tell my son Daniel that his mom wants grandkids and he needs to stop dating Instagram models. She bought a crib already! (Parody promo - make it funny)', 'advice', 'roast'),
  ('Congratulate my friend on finally getting a job after 6 months of "finding himself" in Bali. Roast him a little! (Parody promo)', 'other', 'roast'),
  ('Give my girlfriend a pep talk before her big presentation tomorrow. Hype her up - she''s gonna kill it! (Parody promo)', 'pep-talk', 'pep-talk'),
  ('Roast my coworker for bringing fish to the office microwave AGAIN. Everyone hates it. Make it funny! (Parody promo)', 'roast', 'roast'),
  ('Wish my grandpa Frank happy 80th birthday! He just got an iPhone and keeps accidentally FaceTiming people. Tease him about it! (Parody promo)', 'birthday', 'pep-talk'),
  ('Tell my husband his fantasy football obsession is out of control. It''s ruining family dinners. (Parody promo - be funny but firm)', 'advice', 'roast'),
  ('Motivate my friend who''s running their first 5K tomorrow. They''re freaking out - give them confidence! (Parody promo)', 'pep-talk', 'pep-talk'),
  ('Roast my brother for his terrible dating app profile. Those gym selfies aren''t working bro. Help him out! (Parody promo)', 'roast', 'roast'),
  ('Congratulate my sister on her engagement but roast her fiancé''s man bun. Someone had to say it! (Parody promo)', 'other', 'roast'),
  ('Give my friend advice - should they quit their job to become a TikTok influencer? Spoiler: probably not. (Parody promo)', 'advice', 'advice'),
  ('Tell my roommate he needs to do his dishes. It''s been 3 days. The kitchen smells. Be aggressive! (Parody promo)', 'roast', 'roast'),
  ('Wish my wife a happy anniversary and apologize for forgetting last year. Make me look good! (Parody promo)', 'other', 'advice'),
  ('Roast my friend for spending $200 on sneakers while claiming to be broke. Make it hurt! (Parody promo)', 'roast', 'roast'),
  ('Give my teenager a reality check about their "music career" on SoundCloud. They need to hear it. (Parody promo)', 'advice', 'roast'),
  ('Congratulate my best friend on getting promoted! Finally! Took them long enough. Roast them a bit too. (Parody promo)', 'other', 'pep-talk'),
  ('Tell my girlfriend her cat is NOT more important than me. I''m tired of being second place. Make it funny! (Parody promo)', 'advice', 'roast'),
  ('Roast my dad for his terrible dad jokes. They''re painful. Everyone groans. Help us! (Parody promo)', 'roast', 'roast'),
  ('Give my friend a pep talk - they''re about to ask their crush out. Hype them up! (Parody promo)', 'pep-talk', 'pep-talk'),
  ('Tell my brother to stop posting gym progress pics on Facebook. Nobody cares. Make it funny! (Parody promo)', 'roast', 'roast'),
  ('Wish my mom a happy Mother''s Day and thank her for putting up with me. Make it sweet but funny! (Parody promo)', 'holiday', 'pep-talk'),
  ('Roast my friend for being 30 minutes late to EVERYTHING. Dude, we know you''re not that busy. (Parody promo)', 'roast', 'roast'),
  ('Tell my cousin he needs to stop talking about crypto at family dinners. Nobody understands and nobody cares. (Parody promo)', 'advice', 'roast'),
  ('Give my friend relationship advice - their partner keeps leaving them on read. Red flag or nah? (Parody promo)', 'advice', 'advice');

-- Create function to assign a random unused demo template to a talent
CREATE OR REPLACE FUNCTION assign_demo_template_to_talent(p_talent_id UUID)
RETURNS UUID AS $$
DECLARE
  v_template_id UUID;
  v_existing_templates UUID[];
BEGIN
  -- Get all template IDs this talent has already used
  SELECT ARRAY_AGG(DISTINCT demo_template_id)
  INTO v_existing_templates
  FROM orders
  WHERE talent_id = p_talent_id
    AND demo_template_id IS NOT NULL;
  
  -- Find a random template that hasn't been used by this talent
  SELECT id INTO v_template_id
  FROM demo_video_templates
  WHERE is_active = true
    AND (v_existing_templates IS NULL OR id != ALL(v_existing_templates))
  ORDER BY RANDOM()
  LIMIT 1;
  
  -- If all templates have been used, just pick a random one
  IF v_template_id IS NULL THEN
    SELECT id INTO v_template_id
    FROM demo_video_templates
    WHERE is_active = true
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  RETURN v_template_id;
END;
$$ LANGUAGE plpgsql;

-- Update existing unfulfilled demo orders with unique templates
DO $$
DECLARE
  demo_order RECORD;
  new_template_id UUID;
  new_request_text TEXT;
BEGIN
  FOR demo_order IN 
    SELECT id, talent_id, request_details
    FROM orders
    WHERE order_type = 'demo'
      AND status IN ('pending', 'in_progress')
      AND (demo_template_id IS NULL OR demo_template_id NOT IN (SELECT id FROM demo_video_templates))
  LOOP
    -- Assign a unique template to this talent
    new_template_id := assign_demo_template_to_talent(demo_order.talent_id);
    
    -- Get the template text
    SELECT request_text INTO new_request_text
    FROM demo_video_templates
    WHERE id = new_template_id;
    
    -- Update the order
    UPDATE orders
    SET 
      demo_template_id = new_template_id,
      request_details = new_request_text
    WHERE id = demo_order.id;
    
    RAISE NOTICE 'Updated demo order % for talent % with template %', 
      demo_order.id, demo_order.talent_id, new_template_id;
  END LOOP;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_orders_demo_template ON orders(demo_template_id) WHERE order_type = 'demo';

-- Grant permissions
GRANT SELECT ON demo_video_templates TO authenticated;
GRANT SELECT ON demo_video_templates TO anon;

SELECT '✅ Demo video templates system created and existing orders updated!' AS status;

