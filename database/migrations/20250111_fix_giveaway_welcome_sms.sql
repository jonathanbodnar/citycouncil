-- Fix giveaway welcome SMS to include coupon code
UPDATE sms_flow_messages
SET 
  message_text = '🎉 Congrats! You won a ShoutOut discount! Get a personalized video from your favorite conservative voices. Click to claim:',
  include_coupon = true,
  include_link = true,
  link_utm = 'giveaway'
WHERE flow_id = '11111111-1111-1111-1111-111111111111' 
  AND sequence_order = 1;

