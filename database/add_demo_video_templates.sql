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

-- Insert 30 diverse demo video request templates
INSERT INTO demo_video_templates (request_text, occasion, tone) VALUES
  ('Hey! This is a demo order to help you get started. Please introduce yourself, share what makes you unique, and tell viewers why they should order from you. Keep it fun and authentic!', 'other', 'pep-talk'),
  ('Welcome to ShoutOut! For your demo video, give us your best motivational speech about chasing your dreams. Make it inspiring and personal!', 'other', 'pep-talk'),
  ('Demo time! Pretend you''re wishing someone a happy birthday. Make it hilarious, add some jokes, and show off your personality!', 'birthday', 'roast'),
  ('For this demo, roast your "past self" from 5 years ago. What would you say to that version of you? Make it funny but also a little inspiring!', 'roast', 'roast'),
  ('Create a demo where you''re giving relationship advice to someone who just got ghosted. Be funny, sympathetic, and maybe a little savage!', 'advice', 'roast'),
  ('Demo request: You''re a motivational speaker hyping someone up before their big job interview. Go ALL OUT with the encouragement!', 'pep-talk', 'pep-talk'),
  ('For your demo, wish "future you" a happy New Year. What advice would you give yourself? Make it heartfelt and real.', 'holiday', 'advice'),
  ('Demo scenario: You''re roasting someone''s terrible dating profile. Be brutal but hilarious. Show us your comedy chops!', 'roast', 'roast'),
  ('Welcome demo! Teach us your best life hack or skill. Make it entertaining and show why people love following you!', 'other', 'advice'),
  ('Demo time: Give a pep talk to someone who''s about to run their first marathon. Make them feel like a superhero!', 'pep-talk', 'pep-talk'),
  ('For this demo, answer the question: "What''s the craziest thing that''s ever happened to you?" Make it entertaining!', 'question', 'other'),
  ('Demo request: You''re congratulating someone on their graduation. Make it funny, inspirational, and memorable!', 'other', 'pep-talk'),
  ('Create a demo where you''re giving a toast at a wedding (but make it funny). Show us your charm and wit!', 'other', 'other'),
  ('Demo: Someone''s having the worst day ever. Cheer them up with your best jokes and positive energy!', 'pep-talk', 'pep-talk'),
  ('For your demo, roast social media influencers (including yourself). Keep it self-aware and hilarious!', 'roast', 'roast'),
  ('Demo scenario: Give advice to your 18-year-old self. What do you wish you knew back then? Be real and relatable.', 'advice', 'advice'),
  ('Welcome demo! Share your "origin story" - how you got to where you are today. Make it inspiring and authentic.', 'other', 'pep-talk'),
  ('Demo time: You''re the hype person at someone''s surprise party. Bring the ENERGY and make it unforgettable!', 'birthday', 'pep-talk'),
  ('For this demo, give a sarcastic thank you speech to "2024" for all its chaos. Be funny and relatable!', 'other', 'roast'),
  ('Demo request: Answer "What''s your unpopular opinion?" and defend it with passion and humor!', 'question', 'other'),
  ('Create a demo where you''re motivating someone to finally go to the gym after New Year''s. Make it hilarious but inspiring!', 'pep-talk', 'pep-talk'),
  ('Demo: You''re roasting someone''s terrible fashion choices from the 2000s. Be savage but nostalgic!', 'roast', 'roast'),
  ('For your demo, wish someone a happy Valentine''s Day but make it anti-romantic and funny. Single people will love this!', 'holiday', 'roast'),
  ('Demo scenario: Give career advice to someone thinking about quitting their job. Be honest, funny, and wise.', 'advice', 'advice'),
  ('Welcome demo! Share your most embarrassing moment and what you learned from it. Make us laugh and learn!', 'other', 'other'),
  ('Demo time: You''re hyping up someone before their first date. Give them ALL the confidence!', 'pep-talk', 'pep-talk'),
  ('For this demo, roast your own celebrity crush. Why are they overrated? Make it funny!', 'roast', 'roast'),
  ('Demo request: Give a pep talk to parents dealing with toddler tantrums. Be encouraging and hilarious!', 'pep-talk', 'pep-talk'),
  ('Create a demo where you''re congratulating someone on a promotion. Make it over-the-top and fun!', 'other', 'pep-talk'),
  ('Demo: Answer "If you could have dinner with anyone, dead or alive, who would it be?" Tell us why in an entertaining way!', 'question', 'other');

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

