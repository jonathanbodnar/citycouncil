// Onboarding Reminder System
// This can be run as a scheduled job to send reminder emails

import { supabase } from '../services/supabase';
import { emailService } from '../services/emailService';

export const sendOnboardingReminders = async () => {
  try {
    // Find talents with incomplete onboarding who have created an account (have email)
    const { data: incompleteTalents, error } = await supabase
      .from('talent_profiles')
      .select(`
        id,
        user_id,
        onboarding_token,
        onboarding_completed,
        bio,
        pricing,
        temp_full_name,
        users (
          email,
          full_name,
          created_at
        )
      `)
      .eq('onboarding_completed', false)
      .not('user_id', 'is', null); // Only send to those who have created accounts

    if (error) throw error;
    if (!incompleteTalents || incompleteTalents.length === 0) {
      console.log('No incomplete onboarding profiles found');
      return;
    }

    console.log(`Found ${incompleteTalents.length} talent(s) with incomplete onboarding`);

    for (const talent of incompleteTalents) {
      const user = Array.isArray(talent.users) ? talent.users[0] : talent.users;
      if (!user?.email) continue;

      // Determine current step based on what's completed
      let currentStep = 1;
      if (talent.user_id) currentStep = 2; // Account created
      if (talent.bio && talent.pricing) currentStep = 3; // Profile complete
      
      // Check if bank info exists
      const { data: bankInfo } = await supabase
        .from('vendor_bank_info')
        .select('id')
        .eq('talent_id', talent.id)
        .single();
      
      if (bankInfo) currentStep = 4; // Bank info added

      // Only send if they haven't completed all steps
      if (currentStep < 4 || !talent.onboarding_completed) {
        const accountCreatedAt = new Date(user.created_at);
        const daysSinceStart = Math.floor((Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

        // Send reminders on day 1, 3, 7, 14, 30
        const reminderDays = [1, 3, 7, 14, 30];
        if (reminderDays.includes(daysSinceStart)) {
          const onboardingLink = `${window.location.origin}/onboard/${talent.onboarding_token}`;
          
          await emailService.sendOnboardingReminder(
            user.email,
            user.full_name || talent.temp_full_name || 'there',
            onboardingLink,
            currentStep
          );
          
          console.log(`Sent onboarding reminder to ${user.email} (Day ${daysSinceStart}, Step ${currentStep})`);
        }
      }
    }

    console.log('Onboarding reminders processed');
  } catch (error) {
    console.error('Error sending onboarding reminders:', error);
  }
};

// Check for orders approaching deadline and send reminders
export const sendDeadlineReminders = async () => {
  try {
    // Find orders that are in_progress with deadline within 24 hours
    const tomorrow = new Date();
    tomorrow.setHours(tomorrow.getHours() + 24);

    const { data: approachingDeadline, error } = await supabase
      .from('orders')
      .select(`
        id,
        talent_id,
        fulfillment_deadline,
        users!orders_user_id_fkey (full_name),
        talent_profiles!orders_talent_id_fkey (
          users!talent_profiles_user_id_fkey (email, full_name)
        )
      `)
      .eq('status', 'in_progress')
      .lt('fulfillment_deadline', tomorrow.toISOString())
      .gt('fulfillment_deadline', new Date().toISOString());

    if (error) throw error;
    if (!approachingDeadline || approachingDeadline.length === 0) {
      console.log('No orders approaching deadline');
      return;
    }

    console.log(`Found ${approachingDeadline.length} order(s) approaching deadline`);

    for (const order of approachingDeadline) {
      const talentEmail = (order.talent_profiles as any)?.users?.email;
      const talentName = (order.talent_profiles as any)?.users?.full_name;
      const userName = (order.users as any)?.full_name;

      if (!talentEmail) continue;

      const deadline = new Date(order.fulfillment_deadline);
      const hoursLeft = Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60));

      await emailService.sendOrderDeadlineReminder(
        talentEmail,
        talentName || 'there',
        {
          userName: userName || 'a customer',
          hoursLeft
        }
      );

      console.log(`Sent deadline reminder to ${talentEmail} (${hoursLeft}h left)`);
    }

    console.log('Deadline reminders processed');
  } catch (error) {
    console.error('Error sending deadline reminders:', error);
  }
};

