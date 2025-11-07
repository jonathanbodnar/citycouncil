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

  // Check if user has already reviewed this order
  const hasReviewed = (orderId: string) => {
    return reviews.some(review => review.order_id === orderId);
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

  // Actually download the video
  const downloadVideo = async (order: OrderWithTalent) => {
    try {
      const response = await fetch(order.video_url!);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shoutout-${order.talent_profiles.users.full_name.replace(/\s+/g, '-')}-${order.id.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Video downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download video');
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
                          {order.talent_profiles.category} • ${order.amount.toFixed(2)}
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
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-md">
                        {order.request_details}
                      </p>
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
                to="/home"
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

      {/* Review Prompt Modal */}
      {showReviewPrompt && downloadOrderId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-95 backdrop-blur-sm"
              onClick={() => {
                setShowReviewPrompt(false);
                setDownloadOrderId(null);
              }}
            />

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                  <StarIcon className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Leave a Review First?
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      We'd love to hear your feedback! Would you like to leave a review for this ShoutOut before downloading?
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <Link
                  to={`/review/${downloadOrderId}`}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:col-start-2 sm:text-sm"
                  onClick={() => {
                    setShowReviewPrompt(false);
                    setDownloadOrderId(null);
                  }}
                >
                  Leave Review
                </Link>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  onClick={async () => {
                    const order = orders.find(o => o.id === downloadOrderId);
                    if (order) {
                      await downloadVideo(order);
                    }
                    setShowReviewPrompt(false);
                    setDownloadOrderId(null);
                  }}
                >
                  Download Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
