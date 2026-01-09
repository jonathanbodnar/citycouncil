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

// ShoutOut branded email template
const SHOUTOUT_EMAIL_TEMPLATE = `<!DOCTYPE html>
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
              <img src="https://shoutout.us/shoutout-logo-white.png" alt="ShoutOut" width="150" style="display: block;">
            </td>
          </tr>
          <!-- Main Content Card -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); padding: 40px;">
              <!-- Greeting -->
              <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #ffffff;">
                Hey {{first_name}}! 👋
              </h1>
              
              <!-- Body Content - EDIT THIS -->
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #cbd5e1;">
                Your email content goes here. Share your message with your audience.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px 0;">
                <tr>
                  <td style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); border-radius: 12px;">
                    <a href="https://shoutout.us?utm=email&coupon={{coupon_code}}" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none;">
                      Browse Personalities →
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Signature -->
              <p style="margin: 30px 0 0 0; font-size: 14px; color: #94a3b8;">
                Cheers,<br>
                The ShoutOut Team
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 30px 20px;">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748b;">
                ShoutOut - Personalized Videos from Your Favorite Personalities
              </p>
              <p style="margin: 0; font-size: 12px; color: #475569;">
                <a href="{{unsubscribe_url}}" style="color: #7c3aed; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const EmailFlowManagement: React.FC = () => {
  const [flows, setFlows] = useState<EmailFlow[]>([]);
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
  }, []);

  useEffect(() => {
    if (activeTab === 'queue') {
      fetchUserStatuses();
    } else if (activeTab === 'logs') {
      fetchSendLogs();
    }
  }, [activeTab]);

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
              <img src="https://shoutout.us/shoutout-logo-white.png" alt="ShoutOut" width="150" style="display: block;">
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
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 30px 20px;">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748b;">
                ShoutOut - Personalized Videos from Your Favorite Personalities
              </p>
              <p style="margin: 0; font-size: 12px; color: #475569;">
                <a href="{{unsubscribe_url}}" style="color: #7c3aed; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

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

      // Calculate open rate
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
    setEditorMode('code'); // Start in code mode for existing messages
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
      html_content: SHOUTOUT_EMAIL_TEMPLATE,
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

  const saveMessage = async () => {
    try {
      if (!messageForm.subject.trim()) {
        toast.error('Subject is required');
        return;
      }

      // Build HTML from visual editor if in visual mode
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
                        <td className="px-4 py-3 text-sm">{status.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{status.users?.full_name || '-'}</td>
                        <td className="px-4 py-3 text-sm">{flow?.display_name || 'Unknown'}</td>
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
                      <td className="px-4 py-3 text-sm">{log.email}</td>
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

      {/* Message Edit Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4" style={{ backgroundColor: 'rgba(17, 24, 39, 0.95)' }}>
          <div className="absolute inset-0 bg-gray-900" style={{ backgroundColor: '#0f172a' }}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-600 to-purple-700">
              <h3 className="text-xl font-bold text-white">
                {editingMessage ? 'Edit Email' : 'Add Email to Flow'}
              </h3>
              <button
                onClick={() => setShowMessageModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Subject & Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line *</label>
                  <input
                    type="text"
                    value={messageForm.subject}
                    onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Your email subject"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preview Text</label>
                  <input
                    type="text"
                    value={messageForm.preview_text}
                    onChange={(e) => setMessageForm({ ...messageForm, preview_text: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Text shown in inbox preview"
                  />
                </div>
              </div>

              {/* Timing */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <ClockIcon className="h-5 w-5 text-purple-600" />
                  Send Timing
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Days</label>
                    <input
                      type="number"
                      min="0"
                      value={messageForm.delay_days}
                      onChange={(e) => setMessageForm({ ...messageForm, delay_days: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={messageForm.delay_hours}
                      onChange={(e) => setMessageForm({ ...messageForm, delay_hours: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={messageForm.delay_minutes}
                      onChange={(e) => setMessageForm({ ...messageForm, delay_minutes: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Send At Time</label>
                    <input
                      type="time"
                      value={messageForm.send_at_time}
                      onChange={(e) => setMessageForm({ ...messageForm, send_at_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Delay is calculated from the previous email (or trigger for the first email)
                </p>
              </div>

              {/* Editor Mode Toggle */}
              <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
                <button
                  onClick={() => {
                    if (editorMode === 'code') {
                      setEditorMode('visual');
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    editorMode === 'visual'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <SparklesIcon className="h-4 w-4" />
                  Visual Editor
                </button>
                <button
                  onClick={() => {
                    if (editorMode === 'visual') {
                      // Convert visual to code
                      setMessageForm({ ...messageForm, html_content: buildHtmlFromVisual() });
                      setEditorMode('code');
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    editorMode === 'code'
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <CodeBracketIcon className="h-4 w-4" />
                  HTML Code
                </button>
              </div>

              {/* Visual Editor */}
              {editorMode === 'visual' && (
                <div className="space-y-4">
                  {/* Greeting */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Greeting</label>
                    <input
                      type="text"
                      value={visualContent.greeting}
                      onChange={(e) => setVisualContent({ ...visualContent, greeting: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Hey {{first_name}}! 👋"
                    />
                  </div>

                  {/* Body Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Content</label>
                    <textarea
                      value={visualContent.bodyText}
                      onChange={(e) => setVisualContent({ ...visualContent, bodyText: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      rows={6}
                      placeholder="Share your message with your audience..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use double line breaks for new paragraphs. Variables: {'{{first_name}}'}, {'{{coupon_code}}'}, {'{{talent_name}}'}
                    </p>
                  </div>

                  {/* Add Button/Image Buttons */}
                  <div className="flex gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setVisualContent({ ...visualContent, showButton: !visualContent.showButton })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          visualContent.showButton
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        <LinkIcon className="h-4 w-4" />
                        {visualContent.showButton ? 'Button Added' : 'Add Button'}
                      </button>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setVisualContent({ ...visualContent, showImage: !visualContent.showImage })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          visualContent.showImage
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        <PhotoIcon className="h-4 w-4" />
                        {visualContent.showImage ? 'Image Added' : 'Add Image'}
                      </button>
                    </div>
                  </div>

                  {/* Button Fields */}
                  {visualContent.showButton && (
                    <div className="bg-purple-50 rounded-xl p-4 space-y-3 border border-purple-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-purple-800">Button Settings</span>
                        <button
                          onClick={() => setVisualContent({ ...visualContent, showButton: false, buttonText: '', buttonUrl: '' })}
                          className="text-xs text-red-500 hover:text-red-700"
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
                          className="px-3 py-2 bg-white border border-purple-200 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <input
                          type="url"
                          value={visualContent.buttonUrl}
                          onChange={(e) => setVisualContent({ ...visualContent, buttonUrl: e.target.value })}
                          placeholder="https://shoutout.us?utm=email&coupon={{coupon_code}}"
                          className="px-3 py-2 bg-white border border-purple-200 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Image Fields */}
                  {visualContent.showImage && (
                    <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-800">Image Settings</span>
                        <button
                          onClick={() => setVisualContent({ ...visualContent, showImage: false, imageUrl: '', imageLinkUrl: '' })}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-3">
                        <input
                          type="url"
                          value={visualContent.imageUrl}
                          onChange={(e) => setVisualContent({ ...visualContent, imageUrl: e.target.value })}
                          placeholder="Image URL (https://...)"
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="url"
                          value={visualContent.imageLinkUrl}
                          onChange={(e) => setVisualContent({ ...visualContent, imageLinkUrl: e.target.value })}
                          placeholder="Link when clicked (optional)"
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Signature */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Signature</label>
                    <textarea
                      value={visualContent.signature}
                      onChange={(e) => setVisualContent({ ...visualContent, signature: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                      rows={2}
                      placeholder="Cheers,&#10;The ShoutOut Team"
                    />
                  </div>
                </div>
              )}

              {/* HTML Code Editor */}
              {editorMode === 'code' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HTML Content *</label>
                  <textarea
                    value={messageForm.html_content}
                    onChange={(e) => setMessageForm({ ...messageForm, html_content: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm bg-gray-900 text-green-400"
                    rows={16}
                    placeholder="<html>...</html>"
                    style={{ tabSize: 2 }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Variables: {'{{first_name}}'}, {'{{coupon_code}}'}, {'{{talent_name}}'}, {'{{unsubscribe_url}}'}
                  </p>
                </div>
              )}

              {/* Coupon Options */}
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    id="include_coupon"
                    checked={messageForm.include_coupon}
                    onChange={(e) => setMessageForm({ ...messageForm, include_coupon: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="include_coupon" className="text-sm font-medium text-emerald-800">
                    Include coupon code in email
                  </label>
                </div>
                {messageForm.include_coupon && (
                  <div>
                    <label className="block text-sm font-medium text-emerald-700 mb-1">
                      Specific Coupon Code (optional - leave blank to use user's coupon)
                    </label>
                    <input
                      type="text"
                      value={messageForm.coupon_code}
                      onChange={(e) => setMessageForm({ ...messageForm, coupon_code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="e.g., SAVE15"
                    />
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={messageForm.is_active}
                  onChange={(e) => setMessageForm({ ...messageForm, is_active: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Email is active (will be sent when scheduled)
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-between bg-gray-50">
              <button
                onClick={() => {
                  const content = editorMode === 'visual' ? buildHtmlFromVisual() : messageForm.html_content;
                  setPreviewContent(content);
                  setShowPreviewModal(true);
                }}
                className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-2"
              >
                <EyeIcon className="h-5 w-5" />
                Preview
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMessageModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveMessage}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  {editingMessage ? 'Save Changes' : 'Add Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[10000] p-4" style={{ backgroundColor: 'rgba(17, 24, 39, 0.95)' }}>
          <div className="absolute inset-0 bg-gray-900" style={{ backgroundColor: '#0f172a' }}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Email Preview</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-800">
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
