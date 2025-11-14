# 📱 SMS Comms Center Implementation Plan

## ✅ Completed: Database Schema
- **File:** `database/add_sms_features.sql`
- **Status:** Ready to run in Supabase
- **What it does:**
  - Adds `user_tags`, `sms_subscribed`, `sms_subscribed_at` to `users` table
  - Creates `sms_campaigns` table (tracks mass SMS campaigns)
  - Creates `sms_logs` table (tracks individual SMS delivery)
  - Adds RLS policies (admin-only access)
  - Creates helper functions for user segmentation

**Run this first in Supabase SQL Editor!**

---

## 🚧 TODO: Convert /home from Email to SMS

### Current State:
- `/src/pages/ComingSoonPage.tsx` uses email signup
- Stores in `email_waitlist` table
- Integrates with ActiveCampaign

### Changes Needed:

#### 1. Update State Variables
```typescript
// Change from:
const [email, setEmail] = useState('');

// To:
const [phoneNumber, setPhoneNumber] = useState('');
```

#### 2. Add Phone Formatting Helper
```typescript
const formatPhoneNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};
```

#### 3. Update fetchSpotsRemaining()
```typescript
const fetchSpotsRemaining = async () => {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .contains('user_tags', ['beta'])
      .eq('sms_subscribed', true);

    if (error) throw error;
    
    const remaining = Math.max(0, 197 - (count || 0));
    setSpotsRemaining(remaining);
  } catch (error) {
    console.error('Error fetching spots count:', error);
  }
};
```

#### 4. Replace handleEmailSubmit with handlePhoneSubmit
```typescript
const handlePhoneSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (cleaned.length !== 10) {
    toast.error('Please enter a valid 10-digit phone number');
    return;
  }

  setLoading(true);
  
  try {
    const formattedPhone = `+1${cleaned}`;
    
    // Check if phone already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, user_tags')
      .eq('phone_number', formattedPhone)
      .single();

    if (existingUser) {
      // Update existing user to add 'beta' tag if not present
      const currentTags = existingUser.user_tags || [];
      if (!currentTags.includes('beta')) {
        await supabase
          .from('users')
          .update({
            user_tags: [...currentTags, 'beta'],
            sms_subscribed: true,
            sms_subscribed_at: new Date().toISOString()
          })
          .eq('id', existingUser.id);
      }
      
      setSubmitted(true);
      toast.success('You\'re already on the list! 🎉');
    } else {
      // Create new user with beta tag
      const { error } = await supabase
        .from('users')
        .insert({
          phone_number: formattedPhone,
          user_tags: ['beta'],
          sms_subscribed: true,
          sms_subscribed_at: new Date().toISOString(),
          user_type: 'user',
          full_name: '',
          email: '',
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      
      await fetchSpotsRemaining();
      
      // Track conversion
      if (window.fbq) {
        window.fbq('track', 'Lead', {
          content_name: 'Beta SMS Signup',
          content_category: 'Beta Launch',
          value: 50,
          currency: 'USD'
        });
      }
      
      setSubmitted(true);
      setPhoneNumber('');
      toast.success('You\'re on the list! We\'ll text you when we launch. 📱');
    }
  } catch (error: any) {
    console.error('Error adding to beta list:', error);
    toast.error('Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

#### 5. Update Form JSX (around line 184-201)
```tsx
<form onSubmit={handlePhoneSubmit} className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
  <input
    type="tel"
    value={phoneNumber}
    onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
    placeholder="Enter your phone number"
    maxLength={14}
    className="px-6 py-4 rounded-xl bg-white/10 text-white placeholder-gray-400 border border-white/30 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:outline-none w-full sm:w-auto sm:min-w-96 backdrop-blur-sm"
    disabled={loading}
  />
  <button 
    type="submit"
    disabled={loading}
    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold transition-all flex items-center gap-2 w-full sm:w-auto shadow-lg disabled:opacity-50"
  >
    {loading ? 'Joining...' : 'Claim Beta Spot'}
    <ArrowRightIcon className="h-5 w-5" />
  </button>
</form>
```

#### 6. Update Success Message (around line 211-214)
```tsx
<div className="py-6">
  <p className="text-green-400 text-xl font-semibold">
    Thank you! We'll text you when the app is ready for beta orders! 📱
  </p>
</div>
```

---

## 🚧 TODO: Add SMS Tab to Comms Center

### Create New Component: `src/components/admin/SMSManagement.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { PhoneIcon, UserGroupIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface SMSStats {
  total_campaigns: number;
  total_sent: number;
  total_failed: number;
  beta_subscribers: number;
  registered_subscribers: number;
  total_subscribers: number;
}

interface SMSCampaign {
  id: string;
  created_at: string;
  campaign_name: string;
  message: string;
  target_audience: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
}

const SMSManagement: React.FC = () => {
  const [stats, setStats] = useState<SMSStats | null>(null);
  const [campaigns, setCampaigns] = useState<SMSCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<'beta' | 'registered' | 'all'>('beta');
  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => {
    fetchStats();
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (targetAudience) {
      fetchRecipientCount();
    }
  }, [targetAudience]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_sms_stats');
      if (error) throw error;
      setStats(data[0]);
    } catch (error) {
      console.error('Error fetching SMS stats:', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const { data, error} = await supabase
        .from('sms_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipientCount = async () => {
    try {
      const { data, error } = await supabase.rpc('get_users_by_segment', {
        segment: targetAudience
      });

      if (error) throw error;
      setRecipientCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching recipient count:', error);
      setRecipientCount(0);
    }
  };

  const sendCampaign = async () => {
    if (!campaignName.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    if (message.length > 160) {
      toast.error('Message must be 160 characters or less');
      return;
    }

    if (recipientCount === 0) {
      toast.error('No recipients found for selected audience');
      return;
    }

    const confirm = window.confirm(
      `Send "${campaignName}" to ${recipientCount} ${targetAudience} users?\n\n` +
      `Message: ${message}\n\n` +
      `This action cannot be undone.`
    );

    if (!confirm) return;

    setSending(true);

    try {
      // Call Edge Function to send mass SMS
      const { data, error } = await supabase.functions.invoke('send-mass-sms', {
        body: {
          campaign_name: campaignName,
          message,
          target_audience: targetAudience
        }
      });

      if (error) throw error;

      toast.success(`Campaign "${campaignName}" sent to ${data.sent_count} users!`);
      
      // Reset form
      setCampaignName('');
      setMessage('');
      setTargetAudience('beta');
      setRecipientCount(0);
      
      // Refresh data
      await fetchStats();
      await fetchCampaigns();
    } catch (error: any) {
      console.error('Error sending campaign:', error);
      toast.error('Failed to send campaign: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'sending': return 'text-yellow-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon className="h-5 w-5" />;
      case 'failed': return <XCircleIcon className="h-5 w-5" />;
      default: return null;
    }
  };

  if (loading) {
    return <div className="p-6">Loading SMS management...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Beta Subscribers</p>
              <p className="text-3xl font-bold text-blue-600">{stats?.beta_subscribers || 0}</p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-blue-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Registered Users</p>
              <p className="text-3xl font-bold text-green-600">{stats?.registered_subscribers || 0}</p>
            </div>
            <UserGroupIcon className="h-12 w-12 text-green-400" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Sent</p>
              <p className="text-3xl font-bold text-purple-600">{stats?.total_sent || 0}</p>
            </div>
            <PhoneIcon className="h-12 w-12 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Send SMS Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Send Mass SMS</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign Name
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., Beta Launch Announcement"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Audience
            </label>
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="beta">Beta Users ({stats?.beta_subscribers || 0})</option>
              <option value="registered">Registered Users ({stats?.registered_subscribers || 0})</option>
              <option value="all">All Users ({stats?.total_subscribers || 0})</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              This will send to {recipientCount} users
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message ({message.length}/160)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your SMS message..."
              maxLength={160}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={sendCampaign}
            disabled={sending || !campaignName || !message || recipientCount === 0}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {sending ? 'Sending...' : 'Send SMS Campaign'}
            <PhoneIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Campaign History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Campaign History</h2>
        
        {campaigns.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No campaigns yet</p>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{campaign.campaign_name}</h3>
                      <span className={`flex items-center gap-1 text-sm ${getStatusColor(campaign.status)}`}>
                        {getStatusIcon(campaign.status)}
                        {campaign.status}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mt-1">{campaign.message}</p>
                    <div className="flex gap-4 mt-2 text-sm text-gray-500">
                      <span>Audience: {campaign.target_audience}</span>
                      <span>Sent: {campaign.sent_count}/{campaign.recipient_count}</span>
                      {campaign.failed_count > 0 && (
                        <span className="text-red-600">Failed: {campaign.failed_count}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(campaign.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SMSManagement;
```

### Update `src/components/CommsCenterManagement.tsx`

Add SMS tab to the existing tabs:

```typescript
// Add import
import SMSManagement from './admin/SMSManagement';

// Update tabs constant
const tabs = ['conversations', 'sms', 'notifications'] as const;

// Add to tab content rendering
{activeTab === 'sms' && <SMSManagement />}
```

---

## 🚧 TODO: Create Mass SMS Edge Function

### File: `supabase/functions/send-mass-sms/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SendMassSMSRequest {
  campaign_name: string;
  message: string;
  target_audience: 'beta' | 'registered' | 'all';
}

serve(async (req) => {
  try {
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!userData?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request
    const { campaign_name, message, target_audience }: SendMassSMSRequest = await req.json();

    // Get recipients
    const { data: recipients, error: recipientsError } = await supabase.rpc('get_users_by_segment', {
      segment: target_audience
    });

    if (recipientsError || !recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create campaign record
    const { data: campaign, error: campaignError } = await supabase
      .from('sms_campaigns')
      .insert({
        created_by: user.id,
        campaign_name,
        message,
        target_audience,
        recipient_count: recipients.length,
        status: 'sending'
      })
      .select()
      .single();

    if (campaignError) {
      throw campaignError;
    }

    // Send SMS to each recipient (with rate limiting)
    let sent_count = 0;
    let failed_count = 0;

    for (const recipient of recipients) {
      try {
        // Send via Twilio
        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
              To: recipient.phone_number,
              From: TWILIO_PHONE_NUMBER!,
              Body: message
            })
          }
        );

        const twilioData = await twilioResponse.json();

        // Log SMS
        await supabase.from('sms_logs').insert({
          campaign_id: campaign.id,
          recipient_id: recipient.id,
          phone_number: recipient.phone_number,
          message,
          status: twilioResponse.ok ? 'sent' : 'failed',
          error_message: twilioResponse.ok ? null : twilioData.message,
          sent_at: new Date().toISOString(),
          twilio_sid: twilioData.sid
        });

        if (twilioResponse.ok) {
          sent_count++;
        } else {
          failed_count++;
        }

        // Rate limit: 1 message per 100ms (10/second, well under Twilio's limit)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Failed to send SMS to ${recipient.phone_number}:`, error);
        failed_count++;

        // Log failed SMS
        await supabase.from('sms_logs').insert({
          campaign_id: campaign.id,
          recipient_id: recipient.id,
          phone_number: recipient.phone_number,
          message,
          status: 'failed',
          error_message: error.message
        });
      }
    }

    // Update campaign status
    await supabase
      .from('sms_campaigns')
      .update({
        sent_count,
        failed_count,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', campaign.id);

    return new Response(JSON.stringify({
      success: true,
      campaign_id: campaign.id,
      sent_count,
      failed_count,
      total: recipients.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in send-mass-sms:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

### Deploy Edge Function
```bash
supabase functions deploy send-mass-sms --no-verify-jwt
```

---

## ✅ Summary

### What's Done:
1. ✅ Database schema for SMS features
2. ✅ User tagging system (beta, registered, etc.)
3. ✅ SMS campaign and log tracking tables
4. ✅ Helper functions for user segmentation

### What's Left:
1. 🔧 Convert ComingSoonPage from email to SMS
2. 🔧 Add SMS tab to Comms Center
3. 🔧 Create and deploy `send-mass-sms` Edge Function
4. 🔧 Test end-to-end flow

### Key Features:
- **User Segmentation:** Beta vs Registered users
- **Mass SMS:** Send to filtered groups
- **Campaign Tracking:** See delivery status and history
- **Rate Limiting:** Built into Edge Function (10 SMS/second)
- **Delivery Logs:** Track every SMS sent
- **Admin Only:** RLS policies protect sensitive operations

---

## 🚀 Deployment Order:
1. Run `database/add_sms_features.sql` in Supabase
2. Update `ComingSoonPage.tsx` with phone number signup
3. Create `SMSManagement.tsx` component
4. Update `CommsCenterManagement.tsx` to add SMS tab
5. Create and deploy `send-mass-sms` Edge Function
6. Test with a small batch first!

---

## 📱 Usage Example:
1. Admin opens Comms Center → SMS tab
2. Selects "Beta Users" as audience
3. Writes message: "ShoutOut launches next week! Get ready for your first order 🎉"
4. Clicks "Send SMS Campaign"
5. System sends to all beta-tagged users
6. Real-time delivery tracking in campaign history

**All beta users (from /home signup) get tagged automatically!**

