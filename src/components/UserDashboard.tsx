import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  StarIcon,
  CreditCardIcon,
  UserCircleIcon,
  PlayIcon,
  ShareIcon,
  PencilIcon,
  PlusIcon,
  CloudArrowDownIcon
} from '@heroicons/react/24/outline';
import { HeartIcon, StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Order, Review } from '../types';
import ProfilePictureUpload from './ProfilePictureUpload';
import VideoPlayer from './VideoPlayer';
import ShareModal from './ShareModal';
import toast from 'react-hot-toast';

interface OrderWithTalent extends Order {
  talent_profiles: {
    users: {
      full_name: string;
      avatar_url?: string;
    };
    pricing: number;
    category: string;
    username: string;
  };
}

interface ReviewWithTalent extends Review {
  talent_profiles: {
    users: {
      full_name: string;
    };
  };
}

const UserDashboard: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderWithTalent[]>([]);
  const [reviews, setReviews] = useState<ReviewWithTalent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editedRequestDetails, setEditedRequestDetails] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'reviews' | 'profile'>('orders');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareOrderData, setShareOrderData] = useState<OrderWithTalent | null>(null);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [downloadOrderId, setDownloadOrderId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [updatingPhone, setUpdatingPhone] = useState(false);
  
  // Fill in details modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  const [detailsRecipientName, setDetailsRecipientName] = useState('');
  const [detailsRequestDetails, setDetailsRequestDetails] = useState('');
  const [detailsSpecialInstructions, setDetailsSpecialInstructions] = useState('');
  const [submittingDetails, setSubmittingDetails] = useState(false);

  // Handle tab from URL parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['orders', 'reviews', 'profile'].includes(tabParam)) {
      setActiveTab(tabParam as 'orders' | 'reviews' | 'profile');
    }
  }, [searchParams]);

  useEffect(() => {
    if (user) {
      fetchUserData();
      setPhoneNumber(user.phone || '');
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      console.log('🔍 Fetching orders for user:', user?.id, user?.email);
      
      // Fetch user orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          talent_profiles!orders_talent_id_fkey (
            pricing,
            category,
            username,
            users!talent_profiles_user_id_fkey (
              full_name,
              avatar_url
            )
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      console.log('📦 Orders query result:', {
        count: ordersData?.length || 0,
        error: ordersError,
        orders: ordersData
      });

      if (ordersError) throw ordersError;

      // Fetch user reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          *,
          talent_profiles!reviews_talent_id_fkey (
            users!talent_profiles_user_id_fkey (
              full_name
            )
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      setOrders(ordersData || []);
      setReviews(reviewsData || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'refunded':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <ClockIcon className="h-5 w-5 text-blue-600" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      case 'cancelled':
      case 'refunded':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getApprovalStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <ClockIcon className="h-4 w-4 text-orange-600" />;
      case 'rejected':
        return <XCircleIcon className="h-4 w-4 text-red-600" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const canCancelOrder = (order: OrderWithTalent) => {
    const now = new Date();
    const deadline = new Date(order.fulfillment_deadline);
    return order.status === 'pending' && now > deadline;
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Order cancelled and refund initiated');
      fetchUserData(); // Refresh data
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    }
  };

  const handlePhoneUpdate = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setUpdatingPhone(true);
    try {
      // Update in public.users table
      const { error: userError } = await supabase
        .from('users')
        .update({ phone: phoneNumber })
        .eq('id', user?.id);

      if (userError) throw userError;

      // Update in auth.users metadata
      const { error: metaError } = await supabase.auth.updateUser({
        data: { phone: phoneNumber }
      });

      if (metaError) throw metaError;

      toast.success('Phone number updated successfully!');
      
      // Refresh user data
      await updateProfile({});
    } catch (error: any) {
      console.error('Error updating phone:', error);
      toast.error(error.message || 'Failed to update phone number');
    } finally {
      setUpdatingPhone(false);
    }
  };

  // Check if user has already reviewed this order
  const hasReviewed = (orderId: string) => {
    return reviews.some(review => review.order_id === orderId);
  };

  // Open fill in details modal
  const openDetailsModal = (order: OrderWithTalent) => {
    setDetailsOrderId(order.id);
    setDetailsRecipientName(order.recipient_name || '');
    setDetailsRequestDetails(order.request_details || '');
    setDetailsSpecialInstructions((order as any).special_instructions || '');
    setShowDetailsModal(true);
  };

  // Submit order details
  const handleSubmitDetails = async () => {
    if (!detailsRecipientName.trim()) {
      toast.error('Please enter who this video is for');
      return;
    }
    if (!detailsRequestDetails.trim() || detailsRequestDetails.trim().length < 25) {
      toast.error('Please provide more details about your request (at least 25 characters)');
      return;
    }

    setSubmittingDetails(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          recipient_name: detailsRecipientName.trim(),
          request_details: detailsRequestDetails.trim(),
          special_instructions: detailsSpecialInstructions.trim() || null,
          details_submitted: true
        })
        .eq('id', detailsOrderId);

      if (error) throw error;

      toast.success('Order details submitted! The talent will start working on your video.');
      setShowDetailsModal(false);
      fetchUserData(); // Refresh orders
    } catch (err) {
      console.error('Error submitting details:', err);
      toast.error('Failed to submit details. Please try again.');
    } finally {
      setSubmittingDetails(false);
    }
  };

  // Handle download video - prompt for review if not reviewed yet
  const handleDownloadClick = async (order: OrderWithTalent) => {
    if (!hasReviewed(order.id)) {
      // Show review prompt first
      setDownloadOrderId(order.id);
      setShowReviewPrompt(true);
    } else {
      // Download directly
      await downloadVideo(order);
    }
  };

  // Show caption modal first, then download
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [pendingDownloadOrder, setPendingDownloadOrder] = useState<OrderWithTalent | null>(null);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Actually download the video - works reliably on all browsers
  const performDownload = async (order: OrderWithTalent) => {
    if (downloadStarted) return; // Prevent duplicate downloads
    setDownloadStarted(true);
    setIsDownloading(true);
    
    try {
      const filename = `shoutout-${order.talent_profiles.users.full_name.replace(/\s+/g, '-')}-${order.id.slice(0, 8)}.mp4`;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

      // Mobile: Try native share API first, fall back to opening in new tab
      if (isMobile && navigator.share && navigator.canShare) {
        try {
          const response = await fetch(order.video_url!, { mode: 'cors' });
          if (!response.ok) throw new Error('Fetch failed');
          
          const blob = await response.blob();
          const file = new File([blob], filename, { type: 'video/mp4' });
          
          // Check if we can share files
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'My ShoutOut Video',
              text: `Just got my personalized ShoutOut from ${order.talent_profiles.users.full_name}!`
            });
            toast.success('Video saved!');
            return;
          }
        } catch (shareError: any) {
          console.log('Share failed, trying fallback:', shareError);
          // Fall through to fallback methods
        }
      }

      // iOS Fallback: Open video in new tab (user can long-press to save)
      if (isIOS) {
        window.open(order.video_url!, '_blank');
        toast.success('Video opened! Long-press to save to your camera roll.', { duration: 5000 });
        return;
      }

      // Android/Desktop: Try fetch + download
      try {
        const response = await fetch(order.video_url!, { mode: 'cors' });
        if (!response.ok) throw new Error('Failed to fetch video');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
        
        toast.success('Video downloaded!');
      } catch (fetchError) {
        // Final fallback: Open in new tab
        console.log('Fetch failed, opening in new tab:', fetchError);
        window.open(order.video_url!, '_blank');
        toast.success('Video opened in new tab. Right-click to save.', { duration: 5000 });
      }
    } catch (error) {
      console.error('Download error:', error);
      // Ultimate fallback - just open the video
      window.open(order.video_url!, '_blank');
      toast.success('Video opened! Save from the new tab.', { duration: 5000 });
    } finally {
      setDownloadStarted(false);
      setIsDownloading(false);
    }
  };

  // Show caption modal AND START DOWNLOAD IMMEDIATELY (in parallel)
  const downloadVideo = async (order: OrderWithTalent) => {
    setPendingDownloadOrder(order);
    setShowCaptionModal(true);
    // Start download immediately in parallel (don't await)
    performDownload(order);
  };

  // Handle copy caption (download already started in parallel)
  const handleCopyCaptionAndDownload = async () => {
    if (!pendingDownloadOrder) return;
    
    const talentName = pendingDownloadOrder.talent_profiles.users.full_name;
    const talentUsername = pendingDownloadOrder.talent_profiles.username;
    const suggestedCaption = `Just got my personalized ShoutOut from ${talentName}! 🎉 Get yours at ShoutOut.us/${talentUsername} 🎥 @shoutoutvoice`;
    
    try {
      await navigator.clipboard.writeText(suggestedCaption);
      toast.success('Caption copied! Check your DMs for your 20% off coupon! 🎉');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
    
    // Keep modal open while downloading if still in progress
    if (!isDownloading) {
      setShowCaptionModal(false);
      setPendingDownloadOrder(null);
    }
  };

  // Handle skip (download already started in parallel)
  const handleSkipAndDownload = async () => {
    if (!pendingDownloadOrder) return;
    // Keep modal open while downloading if still in progress
    if (!isDownloading) {
      setShowCaptionModal(false);
      setPendingDownloadOrder(null);
    }
  };

  // Start editing request details
  const startEditingRequest = (order: OrderWithTalent) => {
    setEditingOrderId(order.id);
    setEditedRequestDetails(order.request_details);
  };

  // Cancel editing
  const cancelEditingRequest = () => {
    setEditingOrderId(null);
    setEditedRequestDetails('');
  };

  // Save edited request details
  const saveRequestDetails = async (orderId: string) => {
    if (!editedRequestDetails.trim()) {
      toast.error('Request details cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ request_details: editedRequestDetails })
        .eq('id', orderId);

      if (error) throw error;

      // Update local state
      setOrders(orders.map(order => 
        order.id === orderId 
          ? { ...order, request_details: editedRequestDetails }
          : order
      ));

      toast.success('Request details updated!');
      setEditingOrderId(null);
      setEditedRequestDetails('');
    } catch (error: any) {
      console.error('Error updating request details:', error);
      toast.error(error.message || 'Failed to update request details');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.full_name}!</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'orders', label: 'My Orders', count: orders.length },
              { key: 'reviews', label: 'My Reviews', count: reviews.length },
              { key: 'profile', label: 'Profile Settings', count: null },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.count !== null && (
                  <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                    activeTab === tab.key
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {orders.length > 0 ? (
            orders.map((order) => (
              <div key={order.id} className="glass rounded-2xl shadow-modern border border-white/20 overflow-hidden hover:glass-strong transition-all duration-300">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                        {order.talent_profiles.users.avatar_url ? (
                          <img
                            src={order.talent_profiles.users.avatar_url}
                            alt={order.talent_profiles.users.full_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-xl font-bold text-primary-600">
                            {order.talent_profiles.users.full_name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {order.talent_profiles.users.full_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {order.talent_profiles.category} • ${(Number(order.amount) / 100).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Ordered {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getOrderStatusIcon(order.status)}
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getOrderStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                      {order.is_corporate_order && order.approval_status && (
                        <>
                          {getApprovalStatusIcon(order.approval_status)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getApprovalStatusColor(order.approval_status)}`}>
                            {order.approval_status === 'pending' ? 'Awaiting Approval' : 
                             order.approval_status === 'approved' ? 'Approved' : 'Rejected'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    {/* Show "Fill in details" button if details not submitted */}
                    {!order.details_submitted && order.status === 'pending' ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-amber-800">⚠️ Details Required</h4>
                            <p className="text-sm text-amber-600 mt-1">
                              Tell the talent what you want in your ShoutOut
                            </p>
                          </div>
                          <button
                            onClick={() => openDetailsModal(order)}
                            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
                          >
                            Fill in Details
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">Request Details:</h4>
                          {order.status === 'pending' && editingOrderId !== order.id && (
                            <button
                              onClick={() => startEditingRequest(order)}
                              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                              <PencilIcon className="h-4 w-4" />
                              Edit
                            </button>
                          )}
                        </div>
                        
                        {editingOrderId === order.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editedRequestDetails}
                              onChange={(e) => setEditedRequestDetails(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows={4}
                              placeholder="Describe your request..."
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveRequestDetails(order.id)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditingRequest}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {order.recipient_name && (
                              <p className="text-sm text-gray-500 mb-2">
                                <span className="font-medium">For:</span> {order.recipient_name}
                              </p>
                            )}
                            <p className="text-gray-700 bg-gray-50 p-3 rounded-md whitespace-pre-wrap">
                              {order.request_details}
                            </p>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {order.is_corporate_order && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                        <span className="mr-2">🏢</span>
                        Business Order Details
                      </h4>
                      <div className="space-y-2 text-sm">
                        {order.company_name && (
                          <div>
                            <span className="font-medium text-blue-800">Company:</span>
                            <span className="ml-2 text-blue-700">{order.company_name}</span>
                          </div>
                        )}
                        {order.event_description && (
                          <div>
                            <span className="font-medium text-blue-800">Event:</span>
                            <span className="ml-2 text-blue-700">{order.event_description}</span>
                          </div>
                        )}
                        {order.event_audience && (
                          <div>
                            <span className="font-medium text-blue-800">Audience:</span>
                            <span className="ml-2 text-blue-700">{order.event_audience}</span>
                          </div>
                        )}
                        {order.video_setting_request && (
                          <div>
                            <span className="font-medium text-blue-800">Setting Request:</span>
                            <span className="ml-2 text-blue-700">{order.video_setting_request}</span>
                          </div>
                        )}
                        {order.approval_status === 'rejected' && order.rejection_reason && (
                          <div className="mt-3 pt-3 border-t border-blue-200">
                            <span className="font-medium text-red-800">Rejection Reason:</span>
                            <p className="ml-2 text-red-700 mt-1">{order.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {order.video_url && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Your ShoutOut:</h4>
                      {/* Responsive video container - constrained width on desktop */}
                      <div className="w-full max-w-md mx-auto bg-black rounded-lg overflow-hidden">
                        <VideoPlayer 
                          videoUrl={order.video_url}
                          className="w-full h-auto"
                        />
                      </div>
                      
                      {/* Download Button */}
                      <div className="mt-4">
                        <button
                          onClick={() => handleDownloadClick(order)}
                          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <CloudArrowDownIcon className="h-5 w-5" />
                          <span>Download Video</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex space-x-4">
                      {order.status === 'completed' && order.video_url && (
                        <>
                          <button 
                            onClick={() => {
                              setShareOrderData(order);
                              setShareModalOpen(true);
                            }}
                            className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
                          >
                            <ShareIcon className="h-4 w-4" />
                            <span>Share</span>
                          </button>
                          <Link
                            to={`/review/${order.id}`}
                            className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
                          >
                            <StarIcon className="h-4 w-4" />
                            <span>Leave Review</span>
                          </Link>
                        </>
                      )}
                      {canCancelOrder(order) && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="flex items-center space-x-2 text-red-600 hover:text-red-700"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          <span>Cancel & Refund</span>
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {order.status === 'pending' && (
                        <>
                          {order.is_corporate_order && order.approval_status === 'pending' ? (
                            <span>⏳ Awaiting talent approval - no deadline set yet</span>
                          ) : (
                            <span>Due: {new Date(order.fulfillment_deadline).toLocaleDateString()}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
              <p className="text-gray-600 mb-4">Start by ordering a ShoutOut from your favorite talent!</p>
              <Link
                to="/"
                className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700"
              >
                Browse Talent
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {reviews.length > 0 ? (
            reviews.map((review) => (
              <div key={review.id} className="glass rounded-2xl shadow-modern border border-white/20 p-6 hover:glass-strong transition-all duration-300">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-medium">
                        {review.talent_profiles.users.full_name.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {review.talent_profiles.users.full_name}
                      </h3>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <StarSolid
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-gray-700 mb-2">{review.comment}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <StarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reviews yet</h3>
              <p className="text-gray-600">Complete an order to leave your first review!</p>
            </div>
          )}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="glass rounded-2xl shadow-modern border border-white/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Profile Settings</h2>
          </div>

          <div className="space-y-6">
            {/* Profile Photo Upload */}
            <div className="flex items-center space-x-6 pb-6 border-b border-gray-200">
              <ProfilePictureUpload
                currentAvatarUrl={user?.avatar_url}
                onUploadComplete={async (url) => {
                  try {
                    // The ProfilePictureUpload component handles the database update
                    // Just refresh the local data
                    await fetchUserData();
                  } catch (error) {
                    console.error('Error refreshing data:', error);
                  }
                }}
                size="lg"
              />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Profile Photo</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Upload your profile picture
                </p>
                <p className="text-xs text-gray-500">
                  Recommended: 400x400px, JPG or PNG format, max 5MB
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{user?.full_name}</h3>
                <p className="text-gray-600">{user?.email}</p>
                <p className="text-sm text-gray-500">
                  Member since {new Date(user?.created_at || '').toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={user?.full_name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  readOnly
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter your phone number"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    onClick={handlePhoneUpdate}
                    disabled={updatingPhone || phoneNumber === user?.phone}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {updatingPhone ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Used for SMS notifications about your orders
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type
                </label>
                <input
                  type="text"
                  value="Customer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  readOnly
                />
              </div>
            </div>

            {/* Payment Methods - Temporarily disabled */}
            {/* 
            <div className="pt-6 border-t border-gray-200">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Payment Methods</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CreditCardIcon className="h-6 w-6 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">•••• •••• •••• 4242</p>
                      <p className="text-sm text-gray-600">Expires 12/25</p>
                    </div>
                  </div>
                  <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                    Edit
                  </button>
                </div>
                <button className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-300 hover:text-primary-600 transition-colors">
                  <PlusIcon className="h-6 w-6 mx-auto mb-2" />
                  Add Payment Method
                </button>
              </div>
            </div>
            */}
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModalOpen && shareOrderData && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setShareOrderData(null);
          }}
          talentName={shareOrderData.talent_profiles.users.full_name}
          talentSocialHandles={{
            // We'll need to fetch these from the talent's social accounts
            twitter: '@TuckerCarlson', // This should be fetched dynamically
            facebook: 'TuckerCarlsonOfficial',
          }}
          videoUrl={shareOrderData.video_url}
        />
      )}

      {/* Caption Modal - Shown BEFORE download */}
      {showCaptionModal && pendingDownloadOrder && (
        <div className="fixed z-50 inset-0 overflow-y-auto backdrop-blur-sm">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
            {/* Background overlay - Less transparent */}
            <div 
              className="fixed inset-0 transition-opacity bg-black bg-opacity-90"
              onClick={() => {
                if (!isDownloading) {
                  setShowCaptionModal(false);
                  setPendingDownloadOrder(null);
                }
              }}
            />

            {/* Modal panel - BIGGER and CENTERED */}
            <div className="relative inline-block bg-white rounded-2xl px-8 pt-8 pb-8 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              {isDownloading && (
                <div className="absolute top-4 right-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              )}
              
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0">
                  <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-600">
                    <ShareIcon className="h-8 w-8 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    📱 Share on social media for 20% off your next order!
                  </h3>
                  <p className="text-base text-gray-600">
                    Copy this caption to share your ShoutOut and we'll DM you a 20% off coupon for your next order!
                  </p>
                </div>
              </div>

              {/* Caption Box */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suggested caption:
                </label>
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                  <p className="text-base text-gray-900 leading-relaxed">
                    Just got my personalized ShoutOut from {pendingDownloadOrder.talent_profiles.users.full_name}! 🎉 Get yours at ShoutOut.us/{pendingDownloadOrder.talent_profiles.username} 🎥 @shoutoutvoice
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleCopyCaptionAndDownload}
                  disabled={isDownloading}
                  className="flex-1 inline-flex items-center justify-center rounded-xl border border-transparent shadow-lg px-6 py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-lg font-semibold text-white hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Downloading...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Caption
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSkipAndDownload}
                  disabled={isDownloading}
                  className="flex-1 inline-flex items-center justify-center rounded-xl border-2 border-gray-300 shadow-sm px-6 py-4 bg-white text-lg font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? 'Downloading...' : 'Skip'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fill in Details Modal */}
      {showDetailsModal && detailsOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 transition-opacity bg-black bg-opacity-75"
              onClick={() => !submittingDetails && setShowDetailsModal(false)}
            />

            {/* Modal panel */}
            <div className="relative inline-block bg-white-solid rounded-2xl px-6 pt-6 pb-6 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full z-10 border border-white/20">
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-white mb-2">
                  Fill in Order Details
                </h3>
                <p className="text-sm text-gray-400">
                  Tell the talent what you want in your ShoutOut
                </p>
              </div>

              <div className="space-y-4">
                {/* Recipient Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Who is this video for? <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={detailsRecipientName}
                    onChange={(e) => setDetailsRecipientName(e.target.value)}
                    placeholder="Enter the recipient's name"
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Request Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Your Message Request <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={detailsRequestDetails}
                    onChange={(e) => setDetailsRequestDetails(e.target.value)}
                    rows={4}
                    placeholder="Tell them what you'd like included in your ShoutOut. Be specific about names, details, and the tone you want!"
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {detailsRequestDetails.length}/1000 characters (min 25)
                  </p>
                </div>

                {/* Special Instructions */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Special Instructions (Optional)
                  </label>
                  <textarea
                    value={detailsSpecialInstructions}
                    onChange={(e) => setDetailsSpecialInstructions(e.target.value)}
                    rows={2}
                    placeholder="Any specific requests about delivery, style, or content?"
                    className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  disabled={submittingDetails}
                  className="flex-1 px-4 py-2 bg-slate-700 border border-white/20 rounded-lg text-white hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitDetails}
                  disabled={submittingDetails}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submittingDetails ? 'Submitting...' : 'Submit Details'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Prompt Modal */}
      {showReviewPrompt && downloadOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 transition-opacity bg-black bg-opacity-75"
              onClick={() => {
                setShowReviewPrompt(false);
                setDownloadOrderId(null);
              }}
            />

            {/* Modal panel - Solid dark background like download modal */}
            <div className="relative inline-block align-bottom bg-gray-800 rounded-2xl px-6 pt-6 pb-6 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full z-10">
              <div>
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100">
                  <StarIcon className="h-8 w-8 text-yellow-500" />
                </div>
                <div className="mt-4 text-center">
                  <h3 className="text-xl font-semibold text-white mb-3">
                    Leave a Review First?
                  </h3>
                  <p className="text-sm text-gray-300">
                    We'd love to hear your feedback! Would you like to leave a review for this ShoutOut before downloading?
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-col-reverse sm:flex-row sm:gap-3">
                <button
                  type="button"
                  className="w-full inline-flex justify-center items-center rounded-xl px-6 py-3 bg-gray-700 text-base font-medium text-gray-200 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors mt-3 sm:mt-0"
                  onClick={async () => {
                    const order = orders.find(o => o.id === downloadOrderId);
                    if (order) {
                      await downloadVideo(order);
                    }
                    setShowReviewPrompt(false);
                    setDownloadOrderId(null);
                  }}
                >
                  Skip
                </button>
                <Link
                  to={`/review/${downloadOrderId}`}
                  className="w-full inline-flex justify-center items-center rounded-xl px-6 py-3 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  onClick={() => {
                    setShowReviewPrompt(false);
                    setDownloadOrderId(null);
                  }}
                >
                  Leave Review
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
