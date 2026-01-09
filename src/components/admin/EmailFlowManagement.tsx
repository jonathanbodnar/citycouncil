import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import {
  EnvelopeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  EyeIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  PhotoIcon,
  CodeBracketIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface EmailFlow {
  id: string;
  name: string;
  display_name: string;
  description: string;
  is_active: boolean;
  trigger_type: string;
  created_at: string;
  messages?: EmailFlowMessage[];
}

interface EmailFlowMessage {
  id: string;
  flow_id: string;
  sequence_order: number;
  subject: string;
  preview_text: string;
  html_content: string;
  plain_text_content: string;
  delay_minutes: number;
  delay_hours: number;
  delay_days: number;
  send_at_time: string | null;
  send_on_days: string[] | null;
  include_coupon: boolean;
  coupon_code: string | null;
  is_active: boolean;
}

interface UserFlowStatus {
  id: string;
  email: string;
  flow_id: string;
  current_message_order: number;
  last_email_sent_at: string;
  next_email_scheduled_at: string;
  flow_started_at: string;
  flow_completed_at: string | null;
  source_url: string;
  source_talent_slug: string;
  coupon_code: string;
  coupon_used: boolean;
  is_paused: boolean;
  unsubscribed: boolean;
  user_id: string;
  users?: {
    full_name: string;
  };
}

interface EmailSendLog {
  id: string;
  email: string;
  subject: string;
  status: string;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  flow_id: string;
  email_flows?: {
    display_name: string;
  };
}

const TRIGGER_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  bio_page: { label: 'Bio Page', color: 'bg-purple-100 text-purple-800', icon: '🔗' },
  giveaway: { label: 'Giveaway', color: 'bg-amber-100 text-amber-800', icon: '🎁' },
  direct_signup: { label: 'Direct Signup', color: 'bg-blue-100 text-blue-800', icon: '👋' },
  order_complete: { label: 'Order Complete', color: 'bg-green-100 text-green-800', icon: '📦' },
  talent_signup: { label: 'Talent Signup', color: 'bg-pink-100 text-pink-800', icon: '⭐' },
  manual: { label: 'Manual', color: 'bg-gray-100 text-gray-800', icon: '✋' },
};

// Subscription source labels for footer
const SUBSCRIPTION_SOURCE_LABELS: Record<string, string> = {
  bio_page: 'You subscribed through a talent\'s link in bio.',
  giveaway: 'You entered a ShoutOut giveaway.',
  direct_signup: 'You signed up on ShoutOut.',
  order_complete: 'You ordered a personalized video on ShoutOut.',
  talent_signup: 'You signed up as a talent on ShoutOut.',
  manual: 'You subscribed to ShoutOut updates.',
};

interface TalentPreview {
  id: string;
  temp_full_name: string;
  temp_avatar_url: string;
  slug: string;
}

const EmailFlowManagement: React.FC = () => {
  const [flows, setFlows] = useState<EmailFlow[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<TalentPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFlowId, setExpandedFlowId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<EmailFlowMessage | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [activeTab, setActiveTab] = useState<'flows' | 'queue' | 'logs' | 'templates'>('flows');
  const [userStatuses, setUserStatuses] = useState<UserFlowStatus[]>([]);
  const [sendLogs, setSendLogs] = useState<EmailSendLog[]>([]);
  const [recentFlowLogs, setRecentFlowLogs] = useState<EmailSendLog[]>([]);
  const [editorMode, setEditorMode] = useState<'visual' | 'code'>('visual');
  const [stats, setStats] = useState({
    totalInQueue: 0,
    sentToday: 0,
    sentThisWeek: 0,
    openRate: 0,
    activeFlows: 0,
  });

  // Visual editor state
  const [visualContent, setVisualContent] = useState({
    greeting: 'Hey {{first_name}}! 👋',
    bodyText: '',
    buttonText: 'Browse Personalities →',
    buttonUrl: 'https://shoutout.us?utm=email&coupon={{coupon_code}}',
    showButton: true,
    imageUrl: '',
    imageLinkUrl: '',
    showImage: false,
    signature: 'Cheers,\nThe ShoutOut Team',
  });

  // Message form state
  const [messageForm, setMessageForm] = useState({
    subject: '',
    preview_text: '',
    html_content: '',
    plain_text_content: '',
    delay_minutes: 0,
    delay_hours: 0,
    delay_days: 0,
    send_at_time: '',
    include_coupon: false,
    coupon_code: '',
    is_active: true,
  });

  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);

  useEffect(() => {
    fetchFlows();
    fetchStats();
    fetchFeaturedTalent();
  }, []);

  const fetchFeaturedTalent = async () => {
    try {
      const { data, error } = await supabase
        .from('talent_profiles')
        .select('id, temp_full_name, temp_avatar_url, slug')
        .eq('is_active', true)
        .not('temp_avatar_url', 'is', null)
        .limit(20);

      if (error) throw error;
      // Shuffle and take 4 random talent
      const shuffled = (data || []).sort(() => Math.random() - 0.5);
      setFeaturedTalent(shuffled.slice(0, 4));
    } catch (error) {
      console.error('Error fetching featured talent:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'queue') {
      fetchUserStatuses();
    } else if (activeTab === 'logs') {
      fetchSendLogs();
    }
  }, [activeTab]);

  const fetchFlows = async () => {
    try {
      const { data, error } = await supabase
        .from('email_flows')
        .select(`
          *,
          messages:email_flow_messages(*)
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const flowsWithSortedMessages = (data || []).map(flow => ({
        ...flow,
        messages: (flow.messages || []).sort((a: EmailFlowMessage, b: EmailFlowMessage) => a.sequence_order - b.sequence_order)
      }));
      
      setFlows(flowsWithSortedMessages);
    } catch (error: any) {
      console.error('Error fetching flows:', error);
      toast.error('Failed to load email flows');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { count: queueCount } = await supabase
        .from('user_email_flow_status')
        .select('*', { count: 'exact', head: true })
        .is('flow_completed_at', null)
        .eq('is_paused', false)
        .eq('unsubscribed', false);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from('email_send_log')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', today.toISOString())
        .eq('status', 'sent');

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: weekCount } = await supabase
        .from('email_send_log')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', weekAgo.toISOString())
        .eq('status', 'sent');

      const { count: totalSent } = await supabase
        .from('email_send_log')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', weekAgo.toISOString())
        .in('status', ['sent', 'delivered', 'opened', 'clicked']);

      const { count: totalOpened } = await supabase
        .from('email_send_log')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', weekAgo.toISOString())
        .in('status', ['opened', 'clicked']);

      const { count: activeCount } = await supabase
        .from('email_flows')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setStats({
        totalInQueue: queueCount || 0,
        sentToday: todayCount || 0,
        sentThisWeek: weekCount || 0,
        openRate: totalSent ? Math.round(((totalOpened || 0) / totalSent) * 100) : 0,
        activeFlows: activeCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUserStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('user_email_flow_status')
        .select(`
          *,
          users(full_name)
        `)
        .is('flow_completed_at', null)
        .order('next_email_scheduled_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setUserStatuses(data || []);
    } catch (error: any) {
      console.error('Error fetching user statuses:', error);
    }
  };

  const fetchSendLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('email_send_log')
        .select(`
          *,
          email_flows(display_name)
        `)
        .order('sent_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setSendLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching send logs:', error);
    }
  };

  const fetchRecentFlowLogs = async (flowId: string) => {
    try {
      const { data, error } = await supabase
        .from('email_send_log')
        .select('*')
        .eq('flow_id', flowId)
        .order('sent_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentFlowLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching recent flow logs:', error);
    }
  };

  const toggleFlowActive = async (flow: EmailFlow) => {
    try {
      const { error } = await supabase
        .from('email_flows')
        .update({ is_active: !flow.is_active, updated_at: new Date().toISOString() })
        .eq('id', flow.id);

      if (error) throw error;
      
      toast.success(`Flow ${flow.is_active ? 'paused' : 'activated'}`);
      fetchFlows();
    } catch (error: any) {
      toast.error('Failed to update flow');
    }
  };

  const openEditMessage = (message: EmailFlowMessage) => {
    setEditingMessage(message);
    setMessageForm({
      subject: message.subject,
      preview_text: message.preview_text || '',
      html_content: message.html_content,
      plain_text_content: message.plain_text_content || '',
      delay_minutes: message.delay_minutes || 0,
      delay_hours: message.delay_hours || 0,
      delay_days: message.delay_days || 0,
      send_at_time: message.send_at_time || '',
      include_coupon: message.include_coupon,
      coupon_code: message.coupon_code || '',
      is_active: message.is_active,
    });
    setEditorMode('code');
    setShowMessageModal(true);
  };

  const addMessageToFlow = (flowId: string) => {
    const flow = flows.find(f => f.id === flowId);
    const nextOrder = (flow?.messages?.length || 0) + 1;
    
    setCurrentFlowId(flowId);
    setEditingMessage(null);
    setVisualContent({
      greeting: 'Hey {{first_name}}! 👋',
      bodyText: '',
      buttonText: 'Browse Personalities →',
      buttonUrl: 'https://shoutout.us?utm=email&coupon={{coupon_code}}',
      showButton: true,
      imageUrl: '',
      imageLinkUrl: '',
      showImage: false,
      signature: 'Cheers,\nThe ShoutOut Team',
    });
    setMessageForm({
      subject: '',
      preview_text: '',
      html_content: '',
      plain_text_content: '',
      delay_minutes: 0,
      delay_hours: 0,
      delay_days: nextOrder === 1 ? 0 : 1,
      send_at_time: '',
      include_coupon: false,
      coupon_code: '',
      is_active: true,
    });
    setEditorMode('visual');
    setShowMessageModal(true);
  };

  // Build HTML from visual content
  const buildHtmlFromVisual = () => {
    const bodyParagraphs = visualContent.bodyText.split('\n\n').map(p => 
      `<p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #cbd5e1;">${p.replace(/\n/g, '<br>')}</p>`
    ).join('\n              ');

    const imageHtml = visualContent.showImage && visualContent.imageUrl ? `
              <!-- Image -->
              ${visualContent.imageLinkUrl ? `<a href="${visualContent.imageLinkUrl}">` : ''}
              <img src="${visualContent.imageUrl}" alt="" style="display: block; max-width: 100%; border-radius: 12px; margin: 20px 0;">
              ${visualContent.imageLinkUrl ? '</a>' : ''}` : '';

    const buttonHtml = visualContent.showButton ? `
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 12px;">
                    <a href="${visualContent.buttonUrl}" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">
                      ${visualContent.buttonText}
                    </a>
                  </td>
                </tr>
              </table>` : '';

    // Build talent images for promo card
    const talentImagesHtml = featuredTalent.slice(0, 4).map((t, i) => `
      <td style="width: 60px; padding: 0 2px;">
        <img src="${t.temp_avatar_url}" alt="${t.temp_full_name}" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.2);">
      </td>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ShoutOut</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <a href="https://shoutout.us" style="text-decoration: none;">
                <img src="https://shoutout.us/shoutout-logo-white.png" alt="ShoutOut" width="150" style="display: block;">
              </a>
            </td>
          </tr>
          <!-- Main Content Card -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); padding: 40px;">
              <!-- Greeting -->
              <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #ffffff;">
                ${visualContent.greeting}
              </h1>
              ${imageHtml}
              <!-- Body Content -->
              ${bodyParagraphs}
              ${buttonHtml}
              <!-- Signature -->
              <p style="margin: 30px 0 0 0; font-size: 14px; color: #94a3b8;">
                ${visualContent.signature.replace(/\n/g, '<br>')}
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 24px 0;">
              <div style="border-top: 1px solid rgba(255,255,255,0.1);"></div>
            </td>
          </tr>

          <!-- ShoutOut Promo Card -->
          <tr>
            <td>
              <a href="https://shoutout.us?utm=email_flow&coupon={{coupon_code}}" target="_blank" style="text-decoration: none; display: block;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 16px; overflow: hidden;">
                  <tr>
                    <td style="padding: 24px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="vertical-align: middle;">
                            <div style="color: #ffffff; font-size: 18px; font-weight: 700; margin-bottom: 8px;">Get a Personalized Video ShoutOut</div>
                            <div style="color: #c4b5fd; font-size: 14px;">From top free-speech personalities — starting at $47</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-top: 16px;">
                            <table role="presentation" cellspacing="0" cellpadding="0">
                              <tr>
                                ${talentImagesHtml}
                                <td style="padding-left: 8px;">
                                  <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;">
                                    <span style="color: #ffffff; font-size: 14px; font-weight: 600;">+${Math.max(0, 50 - featuredTalent.length)}</span>
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
                <!-- Logo -->
                <a href="https://shoutout.us" style="text-decoration: none; display: inline-block; margin-bottom: 16px;">
                  <img src="https://shoutout.us/shoutout-logo-white.png" alt="ShoutOut" width="100" style="display: block; opacity: 0.6;">
                </a>
                <!-- Subscription source -->
                <p style="color: #64748b; font-size: 12px; margin: 0 0 8px 0;">
                  {{subscription_source}}
                </p>
                <!-- Links -->
                <p style="color: #64748b; font-size: 12px; margin: 0 0 16px 0;">
                  <a href="{{unsubscribe_url}}" style="color: #7c3aed; text-decoration: underline;">Unsubscribe</a>
                  <span style="color: #475569;">&nbsp;•&nbsp;</span>
                  <a href="https://shoutout.us/privacy" style="color: #64748b; text-decoration: underline;">Privacy Policy</a>
                </p>
                <!-- Address -->
                <p style="color: #475569; font-size: 11px; margin: 0;">
                  ShoutOut, LLC • 1201 N Riverfront Blvd Ste 100, Dallas, TX 75207
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  const saveMessage = async () => {
    try {
      if (!messageForm.subject.trim()) {
        toast.error('Subject is required');
        return;
      }

      const finalHtml = editorMode === 'visual' ? buildHtmlFromVisual() : messageForm.html_content;

      if (!finalHtml.trim()) {
        toast.error('Email content is required');
        return;
      }

      if (editingMessage) {
        const { error } = await supabase
          .from('email_flow_messages')
          .update({
            subject: messageForm.subject,
            preview_text: messageForm.preview_text,
            html_content: finalHtml,
            plain_text_content: messageForm.plain_text_content,
            delay_minutes: messageForm.delay_minutes,
            delay_hours: messageForm.delay_hours,
            delay_days: messageForm.delay_days,
            send_at_time: messageForm.send_at_time || null,
            include_coupon: messageForm.include_coupon,
            coupon_code: messageForm.coupon_code || null,
            is_active: messageForm.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingMessage.id);

        if (error) throw error;
        toast.success('Email updated');
      } else {
        const flow = flows.find(f => f.id === currentFlowId);
        const nextOrder = (flow?.messages?.length || 0) + 1;

        const { error } = await supabase
          .from('email_flow_messages')
          .insert({
            flow_id: currentFlowId,
            sequence_order: nextOrder,
            subject: messageForm.subject,
            preview_text: messageForm.preview_text,
            html_content: finalHtml,
            plain_text_content: messageForm.plain_text_content,
            delay_minutes: messageForm.delay_minutes,
            delay_hours: messageForm.delay_hours,
            delay_days: messageForm.delay_days,
            send_at_time: messageForm.send_at_time || null,
            include_coupon: messageForm.include_coupon,
            coupon_code: messageForm.coupon_code || null,
            is_active: messageForm.is_active,
          });

        if (error) throw error;
        toast.success('Email added to flow');
      }

      setShowMessageModal(false);
      fetchFlows();
    } catch (error: any) {
      console.error('Error saving message:', error);
      toast.error('Failed to save email');
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!window.confirm('Are you sure you want to delete this email?')) return;

    try {
      const { error } = await supabase
        .from('email_flow_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      toast.success('Email deleted');
      fetchFlows();
    } catch (error: any) {
      toast.error('Failed to delete email');
    }
  };

  const duplicateMessage = async (message: EmailFlowMessage) => {
    try {
      const flow = flows.find(f => f.id === message.flow_id);
      const nextOrder = (flow?.messages?.length || 0) + 1;

      const { error } = await supabase
        .from('email_flow_messages')
        .insert({
          flow_id: message.flow_id,
          sequence_order: nextOrder,
          subject: message.subject + ' (Copy)',
          preview_text: message.preview_text,
          html_content: message.html_content,
          plain_text_content: message.plain_text_content,
          delay_minutes: message.delay_minutes,
          delay_hours: message.delay_hours,
          delay_days: message.delay_days,
          send_at_time: message.send_at_time,
          include_coupon: message.include_coupon,
          coupon_code: message.coupon_code,
          is_active: false,
        });

      if (error) throw error;
      toast.success('Email duplicated');
      fetchFlows();
    } catch (error: any) {
      toast.error('Failed to duplicate email');
    }
  };

  const toggleUserPaused = async (status: UserFlowStatus) => {
    try {
      const { error } = await supabase
        .from('user_email_flow_status')
        .update({ is_paused: !status.is_paused, updated_at: new Date().toISOString() })
        .eq('id', status.id);

      if (error) throw error;
      toast.success(`User ${status.is_paused ? 'resumed' : 'paused'}`);
      fetchUserStatuses();
    } catch (error: any) {
      toast.error('Failed to update user');
    }
  };

  const formatDelay = (minutes: number, hours: number, days: number) => {
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.length > 0 ? parts.join(' ') : 'Immediate';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'bg-green-500';
      case 'opened':
        return 'bg-blue-500';
      case 'clicked':
        return 'bg-purple-500';
      case 'bounced':
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <EnvelopeIcon className="h-7 w-7 text-purple-600" />
            Email Flow Management
          </h2>
          <p className="text-gray-600 mt-1">Create and manage automated email sequences</p>
        </div>
        <button
          onClick={() => {
            fetchFlows();
            fetchStats();
            if (activeTab === 'queue') fetchUserStatuses();
            if (activeTab === 'logs') fetchSendLogs();
          }}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowPathIcon className="h-5 w-5" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalInQueue.toLocaleString()}</p>
              <p className="text-sm text-gray-500">In Queue</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <EnvelopeIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.sentToday.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Sent Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CalendarDaysIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.sentThisWeek.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Sent This Week</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <EyeIcon className="h-6 w-6 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.openRate}%</p>
              <p className="text-sm text-gray-500">Open Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <PlayIcon className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.activeFlows}</p>
              <p className="text-sm text-gray-500">Active Flows</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('flows')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'flows'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Email Flows
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'queue'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            User Queue ({stats.totalInQueue})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'logs'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Send History
          </button>
        </nav>
      </div>

      {/* Flows Tab */}
      {activeTab === 'flows' && (
        <div className="space-y-4">
          {flows.map((flow) => (
            <div key={flow.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Flow Header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  const newExpandedId = expandedFlowId === flow.id ? null : flow.id;
                  setExpandedFlowId(newExpandedId);
                  if (newExpandedId) {
                    fetchRecentFlowLogs(flow.id);
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${flow.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{flow.display_name}</h3>
                    <p className="text-sm text-gray-500">{flow.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${TRIGGER_TYPE_LABELS[flow.trigger_type]?.color || 'bg-gray-100 text-gray-800'}`}>
                    {TRIGGER_TYPE_LABELS[flow.trigger_type]?.icon} {TRIGGER_TYPE_LABELS[flow.trigger_type]?.label || flow.trigger_type}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{flow.messages?.length || 0} emails</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFlowActive(flow);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      flow.is_active
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={flow.is_active ? 'Pause Flow' : 'Activate Flow'}
                  >
                    {flow.is_active ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                  </button>
                  {expandedFlowId === flow.id ? (
                    <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Messages */}
              {expandedFlowId === flow.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="space-y-3">
                    {flow.messages?.map((message, index) => (
                      <div
                        key={message.id}
                        className={`bg-white rounded-lg p-4 border ${
                          message.is_active ? 'border-gray-200' : 'border-gray-200 opacity-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded">
                                #{message.sequence_order}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                {formatDelay(message.delay_minutes, message.delay_hours, message.delay_days)} after {index === 0 ? 'trigger' : 'previous'}
                              </span>
                              {message.send_at_time && (
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">
                                  @ {message.send_at_time}
                                </span>
                              )}
                              {message.include_coupon && (
                                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded">
                                  + Coupon
                                </span>
                              )}
                              {!message.is_active && (
                                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-gray-900">{message.subject}</p>
                            {message.preview_text && (
                              <p className="text-sm text-gray-500 mt-1">{message.preview_text}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setPreviewContent(message.html_content);
                                setShowPreviewModal(true);
                              }}
                              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Preview"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => duplicateMessage(message)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Duplicate"
                            >
                              <DocumentDuplicateIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEditMessage(message)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteMessage(message.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add Message Button */}
                    <button
                      onClick={() => addMessageToFlow(flow.id)}
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <PlusIcon className="h-5 w-5" />
                      Add Email to Flow
                    </button>

                    {/* Recent emails sent section */}
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <ClockIcon className="h-4 w-4 text-purple-500" />
                        Recent Emails Sent
                      </h4>
                      {recentFlowLogs.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No emails sent yet</p>
                      ) : (
                        <div className="space-y-2">
                          {recentFlowLogs.map((log) => (
                            <div key={log.id} className="bg-purple-50 rounded-lg p-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(log.status)}`} />
                                <span className="text-sm text-gray-700">{log.email}</span>
                                <span className="text-xs text-gray-500">"{log.subject}"</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  log.status === 'opened' || log.status === 'clicked' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {log.status}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(log.sent_at).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Flow</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Next Send</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {userStatuses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No users in queue
                    </td>
                  </tr>
                ) : (
                  userStatuses.map((status) => {
                    const flow = flows.find(f => f.id === status.flow_id);
                    const totalMessages = flow?.messages?.length || 0;
                    return (
                      <tr key={status.id} className={status.is_paused ? 'bg-gray-50 opacity-60' : ''}>
                        <td className="px-4 py-3 text-sm text-gray-900">{status.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{status.users?.full_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{flow?.display_name || 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">
                            {status.current_message_order}/{totalMessages}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {status.next_email_scheduled_at 
                            ? new Date(status.next_email_scheduled_at).toLocaleString()
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {status.source_talent_slug || status.source_url || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {status.unsubscribed ? (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">Unsubscribed</span>
                          ) : status.is_paused ? (
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs">Paused</span>
                          ) : (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleUserPaused(status)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              status.is_paused
                                ? 'text-green-600 hover:bg-green-50'
                                : 'text-amber-600 hover:bg-amber-50'
                            }`}
                            title={status.is_paused ? 'Resume' : 'Pause'}
                          >
                            {status.is_paused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Flow</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Opened</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Clicked</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sendLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No emails sent yet
                    </td>
                  </tr>
                ) : (
                  sendLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{log.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{log.subject}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{log.email_flows?.display_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          log.status === 'sent' || log.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          log.status === 'opened' ? 'bg-blue-100 text-blue-700' :
                          log.status === 'clicked' ? 'bg-purple-100 text-purple-700' :
                          log.status === 'bounced' || log.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(log.status)}`}></span>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {log.opened_at ? new Date(log.opened_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {log.clicked_at ? new Date(log.clicked_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(log.sent_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Message Edit Modal - Side by Side Layout */}
      {showMessageModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.98)' }}>
          <div className="relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col border border-white/10">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-600 to-purple-700">
              <h3 className="text-xl font-bold text-white">
                {editingMessage ? 'Edit Email' : 'Create Email'}
              </h3>
              <button
                onClick={() => setShowMessageModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex">
              {/* Left Side - Editor */}
              <div className="w-1/2 overflow-y-auto p-6 border-r border-white/10 space-y-5">
                {/* Subject & Preview */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Subject Line *</label>
                    <input
                      type="text"
                      value={messageForm.subject}
                      onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Your email subject"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Preview Text</label>
                    <input
                      type="text"
                      value={messageForm.preview_text}
                      onChange={(e) => setMessageForm({ ...messageForm, preview_text: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Text shown in inbox preview"
                    />
                  </div>
                </div>

                {/* Timing */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-purple-400" />
                    Send Timing
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Days</label>
                      <input
                        type="number"
                        min="0"
                        value={messageForm.delay_days}
                        onChange={(e) => setMessageForm({ ...messageForm, delay_days: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Hours</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={messageForm.delay_hours}
                        onChange={(e) => setMessageForm({ ...messageForm, delay_hours: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Minutes</label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={messageForm.delay_minutes}
                        onChange={(e) => setMessageForm({ ...messageForm, delay_minutes: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">At Time</label>
                      <input
                        type="time"
                        value={messageForm.send_at_time}
                        onChange={(e) => setMessageForm({ ...messageForm, send_at_time: e.target.value })}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Delay from previous email (or trigger for first)
                  </p>
                </div>

                {/* Editor Mode Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditorMode('visual')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      editorMode === 'visual'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <SparklesIcon className="h-4 w-4" />
                    Visual
                  </button>
                  <button
                    onClick={() => {
                      if (editorMode === 'visual') {
                        setMessageForm({ ...messageForm, html_content: buildHtmlFromVisual() });
                      }
                      setEditorMode('code');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      editorMode === 'code'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <CodeBracketIcon className="h-4 w-4" />
                    HTML
                  </button>
                </div>

                {/* Visual Editor */}
                {editorMode === 'visual' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Greeting</label>
                      <input
                        type="text"
                        value={visualContent.greeting}
                        onChange={(e) => setVisualContent({ ...visualContent, greeting: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Hey {{first_name}}! 👋"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Email Content</label>
                      <textarea
                        value={visualContent.bodyText}
                        onChange={(e) => setVisualContent({ ...visualContent, bodyText: e.target.value })}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        rows={5}
                        placeholder="Share your message..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Variables: {'{{first_name}}'}, {'{{coupon_code}}'}, {'{{talent_name}}'}
                      </p>
                    </div>

                    {/* Button/Image toggles */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setVisualContent({ ...visualContent, showButton: !visualContent.showButton })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          visualContent.showButton
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <LinkIcon className="h-4 w-4" />
                        Button
                      </button>
                      <button
                        onClick={() => setVisualContent({ ...visualContent, showImage: !visualContent.showImage })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          visualContent.showImage
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <PhotoIcon className="h-4 w-4" />
                        Image
                      </button>
                    </div>

                    {/* Button Fields */}
                    {visualContent.showButton && (
                      <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-purple-300">Button Settings</span>
                          <button
                            onClick={() => setVisualContent({ ...visualContent, showButton: false })}
                            className="text-xs text-gray-400 hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={visualContent.buttonText}
                            onChange={(e) => setVisualContent({ ...visualContent, buttonText: e.target.value })}
                            placeholder="Button text"
                            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <input
                            type="url"
                            value={visualContent.buttonUrl}
                            onChange={(e) => setVisualContent({ ...visualContent, buttonUrl: e.target.value })}
                            placeholder="https://..."
                            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Image Fields */}
                    {visualContent.showImage && (
                      <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-300">Image Settings</span>
                          <button
                            onClick={() => setVisualContent({ ...visualContent, showImage: false })}
                            className="text-xs text-gray-400 hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="url"
                          value={visualContent.imageUrl}
                          onChange={(e) => setVisualContent({ ...visualContent, imageUrl: e.target.value })}
                          placeholder="Image URL"
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="url"
                          value={visualContent.imageLinkUrl}
                          onChange={(e) => setVisualContent({ ...visualContent, imageLinkUrl: e.target.value })}
                          placeholder="Link when clicked (optional)"
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Signature</label>
                      <textarea
                        value={visualContent.signature}
                        onChange={(e) => setVisualContent({ ...visualContent, signature: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                {/* HTML Code Editor */}
                {editorMode === 'code' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">HTML Content</label>
                    <textarea
                      value={messageForm.html_content}
                      onChange={(e) => setMessageForm({ ...messageForm, html_content: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-950 border border-white/10 rounded-lg text-green-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      rows={14}
                      placeholder="<html>...</html>"
                      style={{ tabSize: 2 }}
                    />
                  </div>
                )}

                {/* Coupon */}
                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="include_coupon"
                      checked={messageForm.include_coupon}
                      onChange={(e) => setMessageForm({ ...messageForm, include_coupon: e.target.checked })}
                      className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="include_coupon" className="text-sm font-medium text-emerald-300">
                      Include coupon code
                    </label>
                  </div>
                  {messageForm.include_coupon && (
                    <input
                      type="text"
                      value={messageForm.coupon_code}
                      onChange={(e) => setMessageForm({ ...messageForm, coupon_code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Coupon code (leave blank for user's code)"
                    />
                  )}
                </div>

                {/* Active */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={messageForm.is_active}
                    onChange={(e) => setMessageForm({ ...messageForm, is_active: e.target.checked })}
                    className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-300">
                    Email is active
                  </label>
                </div>
              </div>

              {/* Right Side - Live Preview */}
              <div className="w-1/2 flex flex-col bg-slate-950 min-h-0">
                {/* Browser Chrome */}
                <div className="flex-shrink-0 bg-gray-900/80 px-3 py-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/60"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/60"></div>
                    </div>
                    <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5 ml-2">
                      <span className="text-gray-400 text-xs">📧 Email Preview</span>
                    </div>
                  </div>
                </div>

                {/* Email Preview - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6" style={{ backgroundColor: '#0f172a' }}>
                  <div className="max-w-md mx-auto pb-8">
                    {/* Logo */}
                    <div className="text-center mb-6">
                      <img 
                        src="https://shoutout.us/shoutout-logo-white.png" 
                        alt="ShoutOut" 
                        className="h-10 mx-auto opacity-90"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                    {/* Main Card */}
                    <div 
                      className="rounded-2xl p-8 mb-6"
                      style={{ 
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      {/* Greeting */}
                      <h1 className="text-2xl font-bold text-white mb-5">
                        {visualContent.greeting || 'Hey there! 👋'}
                      </h1>

                      {/* Image */}
                      {visualContent.showImage && visualContent.imageUrl && (
                        <div className="mb-5 rounded-xl overflow-hidden">
                          <img 
                            src={visualContent.imageUrl} 
                            alt="" 
                            className="w-full h-auto"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* Body */}
                      {visualContent.bodyText ? (
                        <div className="text-gray-300 leading-relaxed whitespace-pre-wrap mb-6">
                          {visualContent.bodyText}
                        </div>
                      ) : (
                        <div className="text-gray-500 italic mb-6">
                          Your message will appear here...
                        </div>
                      )}

                      {/* Button */}
                      {visualContent.showButton && visualContent.buttonText && (
                        <div className="mb-6">
                          <span
                            className="inline-block px-8 py-4 rounded-xl font-bold text-white text-base cursor-pointer"
                            style={{ 
                              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)'
                            }}
                          >
                            {visualContent.buttonText}
                          </span>
                        </div>
                      )}

                      {/* Signature */}
                      <div className="text-gray-400 text-sm whitespace-pre-wrap mt-8 pt-6 border-t border-white/10">
                        {visualContent.signature}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-white/10 my-6"></div>

                    {/* ShoutOut Promo Card */}
                    <a 
                      href="https://shoutout.us"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-2xl p-6 mb-6 hover:opacity-95 transition-opacity"
                      style={{ 
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                        textDecoration: 'none'
                      }}
                    >
                      <h3 className="text-white font-bold text-lg mb-1">
                        Get a Personalized Video ShoutOut
                      </h3>
                      <p className="text-purple-200 text-sm mb-4">
                        From top free-speech personalities — starting at $47
                      </p>
                      
                      {/* Talent Images */}
                      <div className="flex items-center gap-2">
                        {featuredTalent.length > 0 ? (
                          featuredTalent.slice(0, 4).map((talent) => (
                            <div key={talent.id} className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30 flex-shrink-0">
                              <img 
                                src={talent.temp_avatar_url} 
                                alt={talent.temp_full_name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/30 flex-shrink-0"></div>
                            <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/30 flex-shrink-0"></div>
                            <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/30 flex-shrink-0"></div>
                            <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/30 flex-shrink-0"></div>
                          </>
                        )}
                        <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-semibold">+50</span>
                        </div>
                      </div>
                    </a>

                    {/* Footer */}
                    <div className="text-center pt-6 border-t border-white/10">
                      {/* Logo */}
                      <img 
                        src="https://shoutout.us/shoutout-logo-white.png" 
                        alt="ShoutOut" 
                        className="h-6 mx-auto opacity-50 mb-4"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* Subscription source */}
                      <p className="text-gray-500 text-xs mb-2">
                        You subscribed through ShoutOut.
                      </p>
                      {/* Links */}
                      <p className="text-xs mb-3">
                        <span className="text-purple-400">Unsubscribe</span>
                        <span className="text-gray-600 mx-2">•</span>
                        <span className="text-gray-500">Privacy Policy</span>
                      </p>
                      {/* Address */}
                      <p className="text-gray-600 text-[10px]">
                        ShoutOut, LLC • 1201 N Riverfront Blvd Ste 100, Dallas, TX 75207
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-slate-900">
              <button
                onClick={() => setShowMessageModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveMessage}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg hover:from-purple-700 hover:to-purple-600 transition-colors font-medium"
              >
                {editingMessage ? 'Save Changes' : 'Add Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.98)' }}>
          <div className="relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Email Preview</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4" style={{ backgroundColor: '#0f172a' }}>
              <div 
                className="mx-auto"
                style={{ maxWidth: '600px' }}
                dangerouslySetInnerHTML={{ __html: previewContent }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailFlowManagement;
