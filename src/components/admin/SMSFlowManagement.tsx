import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import {
  ChatBubbleLeftRightIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  UserGroupIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

interface SMSFlow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_type: string;
  created_at: string;
  messages?: SMSFlowMessage[];
}

interface SMSFlowMessage {
  id: string;
  flow_id: string;
  sequence_order: number;
  message_text: string;
  delay_hours: number;
  delay_days: number;
  include_coupon: boolean;
  include_link: boolean;
  link_utm: string;
  is_active: boolean;
}

interface UserFlowStatus {
  id: string;
  phone: string;
  flow_id: string;
  current_message_order: number;
  last_message_sent_at: string;
  next_message_scheduled_at: string;
  flow_started_at: string;
  flow_completed_at: string | null;
  coupon_code: string;
  coupon_used: boolean;
  is_paused: boolean;
  user_id: string;
  users?: {
    email: string;
    full_name: string;
  };
}

interface SMSSendLog {
  id: string;
  phone: string;
  message_text: string;
  status: string;
  sent_at: string;
  flow_id: string;
  sms_flows?: {
    name: string;
  };
}

const TRIGGER_TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  giveaway_entry: { label: 'Giveaway Entry', color: 'bg-yellow-100 text-yellow-800', icon: <span>🎁</span> },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-800', icon: <ClockIcon className="h-4 w-4" /> },
  new_talent: { label: 'New Talent', color: 'bg-purple-100 text-purple-800', icon: <span>⭐</span> },
  manual: { label: 'Manual', color: 'bg-gray-100 text-gray-800', icon: <span>✋</span> },
};

const SMSFlowManagement: React.FC = () => {
  const [flows, setFlows] = useState<SMSFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFlowId, setExpandedFlowId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<SMSFlowMessage | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'flows' | 'queue' | 'logs'>('flows');
  const [userStatuses, setUserStatuses] = useState<UserFlowStatus[]>([]);
  const [sendLogs, setSendLogs] = useState<SMSSendLog[]>([]);
  const [stats, setStats] = useState({
    totalInQueue: 0,
    sentToday: 0,
    sentThisWeek: 0,
    activeFlows: 0,
  });

  // Message form state
  const [messageForm, setMessageForm] = useState({
    message_text: '',
    delay_hours: 0,
    delay_days: 0,
    include_coupon: false,
    include_link: true,
    link_utm: '',
    is_active: true,
  });

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

  const fetchFlows = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_flows')
        .select(`
          *,
          messages:sms_flow_messages(*)
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Sort messages by sequence_order
      const flowsWithSortedMessages = (data || []).map(flow => ({
        ...flow,
        messages: (flow.messages || []).sort((a: SMSFlowMessage, b: SMSFlowMessage) => a.sequence_order - b.sequence_order)
      }));
      
      setFlows(flowsWithSortedMessages);
    } catch (error: any) {
      console.error('Error fetching flows:', error);
      toast.error('Failed to load SMS flows');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get queue count
      const { count: queueCount } = await supabase
        .from('user_sms_flow_status')
        .select('*', { count: 'exact', head: true })
        .is('flow_completed_at', null)
        .eq('is_paused', false);

      // Get sent today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from('sms_send_log')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', today.toISOString())
        .eq('status', 'sent');

      // Get sent this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: weekCount } = await supabase
        .from('sms_send_log')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', weekAgo.toISOString())
        .eq('status', 'sent');

      // Get active flows
      const { count: activeCount } = await supabase
        .from('sms_flows')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      setStats({
        totalInQueue: queueCount || 0,
        sentToday: todayCount || 0,
        sentThisWeek: weekCount || 0,
        activeFlows: activeCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUserStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('user_sms_flow_status')
        .select(`
          *,
          users(email, full_name)
        `)
        .is('flow_completed_at', null)
        .order('next_message_scheduled_at', { ascending: true })
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
        .from('sms_send_log')
        .select(`
          *,
          sms_flows(name)
        `)
        .order('sent_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setSendLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching send logs:', error);
    }
  };

  const toggleFlowActive = async (flow: SMSFlow) => {
    try {
      const { error } = await supabase
        .from('sms_flows')
        .update({ is_active: !flow.is_active })
        .eq('id', flow.id);

      if (error) throw error;
      toast.success(`Flow ${flow.is_active ? 'paused' : 'activated'}`);
      fetchFlows();
      fetchStats();
    } catch (error: any) {
      toast.error('Failed to update flow');
    }
  };

  const openEditMessage = (message: SMSFlowMessage) => {
    setEditingMessage(message);
    setMessageForm({
      message_text: message.message_text,
      delay_hours: message.delay_hours,
      delay_days: message.delay_days,
      include_coupon: message.include_coupon,
      include_link: message.include_link,
      link_utm: message.link_utm || '',
      is_active: message.is_active,
    });
    setShowMessageModal(true);
  };

  const saveMessage = async () => {
    if (!editingMessage) return;

    try {
      const { error } = await supabase
        .from('sms_flow_messages')
        .update({
          message_text: messageForm.message_text,
          delay_hours: messageForm.delay_hours,
          delay_days: messageForm.delay_days,
          include_coupon: messageForm.include_coupon,
          include_link: messageForm.include_link,
          link_utm: messageForm.link_utm || null,
          is_active: messageForm.is_active,
        })
        .eq('id', editingMessage.id);

      if (error) throw error;
      toast.success('Message updated');
      setShowMessageModal(false);
      setEditingMessage(null);
      fetchFlows();
    } catch (error: any) {
      toast.error('Failed to update message');
    }
  };

  const addMessageToFlow = async (flowId: string) => {
    const flow = flows.find(f => f.id === flowId);
    if (!flow) return;

    const nextOrder = (flow.messages?.length || 0) + 1;

    try {
      const { error } = await supabase
        .from('sms_flow_messages')
        .insert({
          flow_id: flowId,
          sequence_order: nextOrder,
          message_text: 'New message - click to edit',
          delay_hours: 0,
          delay_days: flow.name === 'giveaway_ongoing' ? 14 : 0,
          include_coupon: false,
          include_link: true,
          link_utm: 'thread',
        });

      if (error) throw error;
      toast.success('Message added');
      fetchFlows();
    } catch (error: any) {
      toast.error('Failed to add message');
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      const { error } = await supabase
        .from('sms_flow_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      toast.success('Message deleted');
      fetchFlows();
    } catch (error: any) {
      toast.error('Failed to delete message');
    }
  };

  const toggleUserPaused = async (status: UserFlowStatus) => {
    try {
      const { error } = await supabase
        .from('user_sms_flow_status')
        .update({ is_paused: !status.is_paused })
        .eq('id', status.id);

      if (error) throw error;
      toast.success(`User ${status.is_paused ? 'resumed' : 'paused'}`);
      fetchUserStatuses();
    } catch (error: any) {
      toast.error('Failed to update user status');
    }
  };

  const formatDelay = (hours: number, days: number) => {
    if (days > 0 && hours > 0) return `${days}d ${hours}h`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return 'Immediate';
  };

  const getFlowDisplayName = (name: string) => {
    const names: Record<string, string> = {
      giveaway_welcome: '🎁 Giveaway Welcome',
      giveaway_followup: '⏰ 72-Hour Follow-up',
      giveaway_ongoing: '📱 Bi-Weekly Engagement',
      new_talent_announcement: '⭐ New Talent Announcement',
    };
    return names[name] || name;
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
            <ChatBubbleLeftRightIcon className="h-7 w-7 text-blue-600" />
            SMS Flow Management
          </h2>
          <p className="text-gray-600 mt-1">Manage automated SMS sequences and view delivery status</p>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="p-2 bg-yellow-100 rounded-lg">
              <PlayIcon className="h-6 w-6 text-yellow-600" />
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
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            SMS Flows
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'queue'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            User Queue ({stats.totalInQueue})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
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
                onClick={() => setExpandedFlowId(expandedFlowId === flow.id ? null : flow.id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${flow.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{getFlowDisplayName(flow.name)}</h3>
                    <p className="text-sm text-gray-500">{flow.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${TRIGGER_TYPE_LABELS[flow.trigger_type]?.color || 'bg-gray-100'}`}>
                    {TRIGGER_TYPE_LABELS[flow.trigger_type]?.label || flow.trigger_type}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{flow.messages?.length || 0} messages</span>
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
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                                #{message.sequence_order}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                {formatDelay(message.delay_hours, message.delay_days)} after {index === 0 ? 'trigger' : 'previous'}
                              </span>
                              {message.include_coupon && (
                                <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded">
                                  + Coupon
                                </span>
                              )}
                              {!message.is_active && (
                                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <p className="text-gray-800 whitespace-pre-wrap text-sm">{message.message_text}</p>
                            {message.link_utm && (
                              <p className="text-xs text-gray-400 mt-1">UTM: {message.link_utm}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
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
                      className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                    >
                      <PlusIcon className="h-5 w-5" />
                      Add Message to Flow
                    </button>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Flow</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Next Send</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Coupon</th>
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
                        <td className="px-4 py-3 text-sm font-mono">{status.phone}</td>
                        <td className="px-4 py-3 text-sm">
                          {status.users?.full_name || status.users?.email || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">{getFlowDisplayName(flow?.name || '')}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="font-medium">{status.current_message_order}</span>
                          <span className="text-gray-400">/{totalMessages}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {status.next_message_scheduled_at
                            ? new Date(status.next_message_scheduled_at).toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {status.coupon_code && (
                            <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                              status.coupon_used ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {status.coupon_code}
                              {status.coupon_used && ' ✓'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {status.is_paused ? (
                            <span className="text-yellow-600 flex items-center gap-1">
                              <PauseIcon className="h-4 w-4" /> Paused
                            </span>
                          ) : (
                            <span className="text-green-600 flex items-center gap-1">
                              <PlayIcon className="h-4 w-4" /> Active
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => toggleUserPaused(status)}
                            className={`p-1.5 rounded transition-colors ${
                              status.is_paused
                                ? 'text-green-600 hover:bg-green-50'
                                : 'text-yellow-600 hover:bg-yellow-50'
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Flow</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Message</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sendLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No SMS logs yet
                    </td>
                  </tr>
                ) : (
                  sendLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(log.sent_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono">{log.phone}</td>
                      <td className="px-4 py-3 text-sm">{log.sms_flows?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm max-w-md truncate" title={log.message_text}>
                        {log.message_text.substring(0, 60)}...
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {log.status === 'sent' ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircleIcon className="h-4 w-4" /> Sent
                          </span>
                        ) : log.status === 'failed' ? (
                          <span className="text-red-600 flex items-center gap-1">
                            <XCircleIcon className="h-4 w-4" /> Failed
                          </span>
                        ) : (
                          <span className="text-gray-500">{log.status}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Message Modal */}
      {showMessageModal && editingMessage && (
        <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Message</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message Text</label>
                <textarea
                  rows={5}
                  value={messageForm.message_text}
                  onChange={(e) => setMessageForm({ ...messageForm, message_text: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Enter SMS message..."
                />
                <p className="text-xs text-gray-500 mt-1">{messageForm.message_text.length} characters</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delay (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={messageForm.delay_days}
                    onChange={(e) => setMessageForm({ ...messageForm, delay_days: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delay (Hours)</label>
                  <input
                    type="number"
                    min="0"
                    value={messageForm.delay_hours}
                    onChange={(e) => setMessageForm({ ...messageForm, delay_hours: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UTM Parameter</label>
                <input
                  type="text"
                  value={messageForm.link_utm}
                  onChange={(e) => setMessageForm({ ...messageForm, link_utm: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., thread, followup, announcement"
                />
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={messageForm.include_coupon}
                    onChange={(e) => setMessageForm({ ...messageForm, include_coupon: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Include user's coupon code</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={messageForm.is_active}
                    onChange={(e) => setMessageForm({ ...messageForm, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Message active</span>
                </label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setEditingMessage(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveMessage}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SMSFlowManagement;

