import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  StarIcon,
  CameraIcon,
  UserCircleIcon,
  PencilIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  PlayIcon,
  CloudArrowUpIcon,
  BanknotesIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import { HeartIcon, StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Order, Review, TalentProfile } from '../types';
import ProfilePictureUpload from './ProfilePictureUpload';
import SocialAccountsManager from './SocialAccountsManager';
import CategorySelector from './CategorySelector';
import CharitySelector from './CharitySelector';
import IntegratedPayoutsDashboard from './IntegratedPayoutsDashboard';
import MFASettings from './MFASettings';
import PhoneNumberPrompt from './PhoneNumberPrompt';
import MediaCenter from './MediaCenter';
import { uploadVideoToWasabi } from '../services/videoUpload';
import { emailService } from '../services/emailService';
import { notificationService } from '../services/notificationService';
import toast from 'react-hot-toast';

interface OrderWithUser extends Order {
  users: {
    full_name: string;
    avatar_url?: string;
  };
}

interface ReviewWithUser extends Review {
  users: {
    full_name: string;
  };
}

// Feature flag: Only show Bio tab for specific users on dev environment
const BIO_FEATURE_ALLOWED_EMAILS = ['jb@apollo.inc'];
const IS_DEV_ENVIRONMENT = window.location.hostname === 'dev.shoutout.us' || window.location.hostname === 'localhost';

// Helper to get the display amount for an order
// ALWAYS show the talent's video price (original_amount), not the discounted customer price
// Talent gets paid based on their video price minus 25% admin fee, regardless of coupon
const getOrderDisplayAmount = (order: Order): number => {
  // If original_amount exists (set to talent's pricing in cents), use that
  if (order.original_amount && order.original_amount > 0) {
    return Number(order.original_amount);
  }
  // Fallback to order amount (for orders without coupons, this IS the talent's price)
  return Number(order.amount);
};

const TalentDashboard: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<OrderWithUser[]>([]);
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'analytics' | 'profile' | 'payouts' | 'media' | 'bio'>('analytics');
  const [uploadingVideo, setUploadingVideo] = useState<string | null>(null);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [userHasPhone, setUserHasPhone] = useState(true);
  const [userPhone, setUserPhone] = useState('');
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

  // Check if user has access to Bio feature (only on dev environment)
  const hasBioAccess = IS_DEV_ENVIRONMENT && user?.email && BIO_FEATURE_ALLOWED_EMAILS.includes(user.email.toLowerCase());

  // Handle tab from URL parameter
  const tabParam = searchParams.get('tab');
  useEffect(() => {
    const validTabs = ['orders', 'analytics', 'profile', 'payouts', 'media'];
    if (hasBioAccess) validTabs.push('bio');
    
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam as 'orders' | 'analytics' | 'profile' | 'payouts' | 'media' | 'bio');
    } else {
      // Default to analytics (stats) when no tab parameter
      setActiveTab('analytics');
    }
  }, [tabParam, hasBioAccess]); // Watch the actual tab value

  // Handle order parameter from fulfillment link
  useEffect(() => {
    const orderParam = searchParams.get('order');
    if (orderParam && orders.length > 0) {
      // Set orders tab
      setActiveTab('orders');
      // Highlight the order
      setHighlightedOrderId(orderParam);
      // Scroll to the order after a short delay
      setTimeout(() => {
        const orderElement = document.getElementById(`order-${orderParam}`);
        if (orderElement) {
          orderElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Flash animation
          orderElement.classList.add('animate-pulse');
          setTimeout(() => {
            orderElement.classList.remove('animate-pulse');
            // Remove highlight after 5 seconds
            setTimeout(() => setHighlightedOrderId(null), 5000);
          }, 2000);
        }
      }, 300);
    }
  }, [searchParams, orders]);

  useEffect(() => {
    if (user) {
      fetchTalentData();
    }
  }, [user]);

  // Real-time subscription for order updates (e.g., when customer submits details)
  useEffect(() => {
    if (!talentProfile?.id) return;

    const channel = supabase
      .channel(`orders-talent-${talentProfile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `talent_id=eq.${talentProfile.id}`
        },
        (payload) => {
          console.log('📬 Order updated (real-time):', payload);
          // Update the order in state
          setOrders(prevOrders => 
            prevOrders.map(order => 
              order.id === payload.new.id 
                ? { ...order, ...payload.new }
                : order
            )
          );
          
          // Show toast if details were just submitted
          if (payload.new.details_submitted && !payload.old?.details_submitted) {
            toast.success('Customer submitted order details!', {
              icon: '📝',
              duration: 5000
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `talent_id=eq.${talentProfile.id}`
        },
        (payload) => {
          console.log('📬 New order (real-time):', payload);
          // Refresh to get full order data with user info
          fetchTalentData();
          toast.success('New order received!', {
            icon: '🎉',
            duration: 5000
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [talentProfile?.id]);

  const fetchTalentData = async () => {
    try {
      // Fetch talent profile
      const { data: profileData, error: profileError } = await supabase
        .from('talent_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      setTalentProfile(profileData);

      // Check if user has phone number
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('phone')
        .eq('id', user?.id)
        .single();

      if (!userError && userData) {
        const hasPhone = !!userData.phone;
        setUserHasPhone(hasPhone);
        
        // Format phone for display if exists
        if (userData.phone) {
          const cleaned = userData.phone.replace(/\D/g, '').slice(-10); // Remove +1 and formatting
          if (cleaned.length === 10) {
            const formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
            setUserPhone(formatted);
          }
        }
        
        // Show prompt if no phone and hasn't been dismissed this session
        const dismissedThisSession = sessionStorage.getItem('phonePromptDismissed');
        if (!hasPhone && !dismissedThisSession) {
          setShowPhonePrompt(true);
        }
      }

      // Fetch orders for this talent
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          users!orders_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('talent_id', profileData.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Fetch reviews for this talent
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select(`
          *,
          users!reviews_user_id_fkey (
            full_name
          )
        `)
        .eq('talent_id', profileData.id)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      setOrders(ordersData || []);
      setReviews(reviewsData || []);
    } catch (error) {
      console.error('Error fetching talent data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleVideoUpload = async (orderId: string, file: File) => {
    setUploadingVideo(orderId);
    
    try {
      // Log upload attempt details
      console.log('📹 Video upload starting:', {
        orderId,
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        fileType: file.type,
        talentUsername: talentProfile?.username,
        timestamp: new Date().toISOString()
      });

      // Step 1: Upload video to Wasabi S3
      toast.loading('Uploading video...', { id: 'upload' });
      const uploadResult = await uploadVideoToWasabi(file, orderId);
      
      console.log('📹 Wasabi upload result:', {
        success: uploadResult.success,
        videoUrl: uploadResult.videoUrl,
        error: uploadResult.error
      });
      
      if (!uploadResult.success) {
        const errorMsg = uploadResult.error || 'Upload failed';
        console.error('❌ Upload failed:', errorMsg);
        toast.error(errorMsg, { id: 'upload' });
        return;
      }
      toast.success('Video uploaded!', { id: 'upload' });

      // Step 2: Apply watermark via Cloudinary
      let finalVideoUrl = uploadResult.videoUrl;
      try {
        toast.loading('Adding watermark...', { id: 'watermark' });
        const { data: watermarkData, error: watermarkError } = await supabase.functions.invoke('watermark-video', {
          body: { 
            videoUrl: uploadResult.videoUrl,
            orderId: orderId,
            talentName: user?.full_name || 'Talent'
          }
        });

        if (!watermarkError && watermarkData?.watermarkedUrl) {
          finalVideoUrl = watermarkData.watermarkedUrl;
          toast.success('Watermark applied!', { id: 'watermark' });
        } else {
          console.warn('Watermarking failed, using original video');
          toast.dismiss('watermark');
        }
      } catch (watermarkError) {
        console.error('Watermark error:', watermarkError);
        // Continue with original video if watermarking fails
        toast.dismiss('watermark');
      }

      // Step 3: Update order with watermarked video URL and mark as completed
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'completed',
          video_url: finalVideoUrl
        })
        .eq('id', orderId);

      if (error) throw error;

      // Send delivery notifications
      try {
        console.log('🔔 Fetching order data for delivery notifications...', orderId);
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('user_id, users!orders_user_id_fkey (email, full_name)')
          .eq('id', orderId)
          .single();

        if (orderError) {
          console.error('❌ Error fetching order data for notifications:', orderError);
          throw orderError;
        }

        if (orderData) {
          const userData = (orderData as any).users;
          console.log('📧 User data for notifications:', { 
            userId: (orderData as any).user_id, 
            email: userData?.email,
            name: userData?.full_name 
          });
          
          // Email user that ShoutOut is ready (non-blocking)
          if (userData?.email && uploadResult.videoUrl) {
            console.log('📧 Sending delivery email to:', userData.email);
            emailService.sendOrderDelivered(
              userData.email,
              userData.full_name,
              {
                talentName: user?.full_name || 'Your talent',
                videoUrl: uploadResult.videoUrl
              }
            ).then(() => console.log('✅ Delivery email sent'))
             .catch((e) => console.warn('⚠️ Email send failed (non-critical):', e));
          }

          // In-app notification for user (non-blocking)
          if ((orderData as any).user_id) {
            console.log('🔔 Creating in-app notification for user:', (orderData as any).user_id);
            notificationService.notifyOrderDelivered(
              (orderData as any).user_id,
              orderId,
              user?.full_name || 'Your talent'
            ).then(() => console.log('✅ In-app notification created'))
             .catch((e) => console.warn('⚠️ Notification failed (non-critical):', e));
          } else {
            console.warn('⚠️ No user_id found in order data');
          }
        } else {
          console.warn('⚠️ No order data returned');
        }
      } catch (notifError) {
        console.error('❌ Error sending delivery notifications:', notifError);
        // Don't let notification errors stop the upload process
        toast.error('Video uploaded but notifications failed. Please contact support.');
      }

      toast.success('Video uploaded and order completed!');
      
      // Refresh data first
      await fetchTalentData();
      
      // Check if there are any remaining pending or in-progress orders
      const { data: remainingOrders, error: ordersCheckError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('talent_id', talentProfile?.id)
        .in('status', ['pending', 'in_progress']);
      
      if (!ordersCheckError && remainingOrders) {
        const hasMoreOrders = remainingOrders.length > 0;
        
        console.log('📊 Remaining orders check:', {
          totalRemaining: remainingOrders.length,
          hasMore: hasMoreOrders,
          willRedirect: !hasMoreOrders
        });
        
        // Show success message - stay on dashboard
        if (!hasMoreOrders) {
          toast.success('All orders completed! 🎉', { duration: 3000 });
        } else {
          toast.success(`Video uploaded! ${remainingOrders.length} order(s) remaining`, { duration: 3000 });
        }
      }
    } catch (error: any) {
      console.error('❌ Video upload error:', {
        orderId,
        error: error,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorDetails: error?.details,
        talentUsername: talentProfile?.username,
        timestamp: new Date().toISOString()
      });
      
      // Show more specific error message to user
      const userMessage = error?.message || error?.toString() || 'Failed to upload video. Please try again.';
      toast.error(userMessage);
    } finally {
      setUploadingVideo(null);
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

  const handleAcceptOrder = async (orderId: string) => {
    try {
      console.log('Accepting order:', orderId);
      
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'in_progress' })
        .eq('id', orderId)
        .select()
        .single();

      if (error) {
        console.error('Error updating order status:', error);
        throw error;
      }

      console.log('Order accepted successfully:', data);
      toast.success('Order accepted! You can now upload the video.');
      
      // Refresh data to show updated status
      await fetchTalentData();
    } catch (error: any) {
      console.error('Error accepting order:', error);
      toast.error(error.message || 'Failed to accept order');
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    try {
      const now = new Date().toISOString();
      
      // Get order details for notification
      const orderToApprove = orders.find(o => o.id === orderId);
      
      // Calculate fulfillment deadline from approval time
      const fulfillmentDeadline = new Date();
      fulfillmentDeadline.setHours(fulfillmentDeadline.getHours() + (talentProfile?.fulfillment_time_hours || 48));
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          approval_status: 'approved',
          approved_at: now,
          status: 'in_progress',
          fulfillment_deadline: fulfillmentDeadline.toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      // Notify user that order was approved
      if (orderToApprove) {
        await notificationService.notifyOrderApproved(
          orderToApprove.user_id,
          orderId,
          user?.full_name || 'Your talent'
        );
      }

      toast.success('Corporate order approved! Timer has started.');
      fetchTalentData();
    } catch (error) {
      console.error('Error approving order:', error);
      toast.error('Failed to approve order');
    }
  };

  const handleRejectOrder = async (orderId: string, reason: string) => {
    try {
      // Find the order to get transaction ID
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        toast.error('Order not found');
        return;
      }

      if (!order.payment_transaction_id) {
        toast.error('Cannot process refund: No transaction ID found');
        return;
      }

      // Import refund service dynamically
      const { refundService } = await import('../services/refundService');

      toast.loading('Processing refund...', { id: 'refund' });

      // Process refund through Fortis
      const result = await refundService.processRefund({
        orderId: orderId,
        transactionId: order.payment_transaction_id,
        reason: reason,
        deniedBy: 'talent',
      });

      if (result.success) {
        toast.success('Order denied and refund processed successfully', { id: 'refund' });
        setRejectingOrderId(null);
        setRejectionReason('');
        fetchTalentData();
      } else {
        toast.error(result.error || 'Failed to process refund', { id: 'refund' });
      }
    } catch (error: any) {
      console.error('Error rejecting order:', error);
      toast.error(error.message || 'Failed to deny order', { id: 'refund' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!talentProfile) {
    return (
      <div className="text-center py-12">
        <UserCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Complete Your Profile</h3>
        <p className="text-gray-600 mb-4">Set up your talent profile to start receiving orders!</p>
        <Link
          to="/profile/setup"
          className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-2xl font-medium hover:from-blue-700 hover:to-blue-800 shadow-modern hover:shadow-modern-lg transition-all duration-300"
        >
          Setup Profile
        </Link>
      </div>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const inProgressOrders = orders.filter(o => o.status === 'in_progress');
  const completedOrders = orders.filter(o => o.status === 'completed');

  return (
    <div>

      {/* Phone Number Prompt (if missing) */}
      {showPhonePrompt && !userHasPhone && (
        <PhoneNumberPrompt
          onComplete={() => {
            setShowPhonePrompt(false);
            setUserHasPhone(true);
            fetchTalentData(); // Refresh data
          }}
          onDismiss={() => {
            setShowPhonePrompt(false);
            sessionStorage.setItem('phonePromptDismissed', 'true');
          }}
        />
      )}

      {/* Self-Promo Link Banner */}
      {talentProfile && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-red-500/20 border border-green-500/30">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            {/* Left side - Promo Link */}
            <div className="flex-1">
              <h3 className="font-semibold text-white text-lg">Christmas Games 🎄</h3>
              <p className="text-sm text-gray-300 mt-1">Use this special link when you promote to <span className="underline font-medium text-white">earn double</span> off every order you generate until Christmas.</p>
              <button
                onClick={() => {
                  const promoUrl = `https://shoutout.us/${talentProfile.username || talentProfile.id}?utm=1`;
                  navigator.clipboard.writeText(promoUrl);
                  toast.success('Promo link copied!');
                }}
                className="text-sm text-green-300 hover:text-green-200 bg-green-900/30 hover:bg-green-900/50 px-3 py-1.5 rounded mt-2 inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span>📋</span>
                <span>shoutout.us/{talentProfile.username || talentProfile.id}?utm=1</span>
              </button>
            </div>
            
            {/* Right side - Christmas Deadline */}
            <div className="flex-1 md:border-l md:border-green-500/30 md:pl-4">
              <p className="text-sm text-yellow-300 font-medium">⚠️ Important: Set the last day to order a ShoutOut to get it by Christmas!</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={talentProfile.christmas_deadline || ''}
                  min={new Date().toISOString().split('T')[0]}
                  max="2025-12-25"
                  onChange={async (e) => {
                    const newDate = e.target.value;
                    try {
                      const { error } = await supabase
                        .from('talent_profiles')
                        .update({ christmas_deadline: newDate || null })
                        .eq('id', talentProfile.id);
                      
                      if (error) throw error;
                      
                      setTalentProfile({ ...talentProfile, christmas_deadline: newDate });
                      toast.success(newDate ? `Deadline set to ${new Date(newDate).toLocaleDateString()}` : 'Deadline cleared');
                    } catch (err) {
                      console.error('Failed to update deadline:', err);
                      toast.error('Failed to save deadline');
                    }
                  }}
                  className="px-3 py-1.5 rounded bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                {talentProfile.christmas_deadline && (
                  <span className="text-xs text-green-300">
                    ✓ Set to {new Date(talentProfile.christmas_deadline + 'T00:00:00').toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">Orders after this date will show a warning that delivery before Christmas isn't guaranteed.</p>
            </div>
          </div>
        </div>
      )}

      {/* Payout Setup Reminder Banner */}
      {talentProfile && !talentProfile.payout_onboarding_completed && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/20">
                <BanknotesIcon className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Complete Your Payout Setup</h3>
              </div>
            </div>
            <button
              onClick={() => navigate('/payout-setup')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
            >
              Set Up Payouts
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation - Hidden on Mobile */}
      <div className="mb-8 hidden md:block">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'orders', label: 'Orders', count: orders.length },
              { key: 'analytics', label: 'Analytics', count: null },
              { key: 'media', label: 'Media Center', count: null },
              { key: 'payouts', label: 'Payouts', count: null, icon: BanknotesIcon },
              { key: 'profile', label: 'Profile Settings', count: null },
              // Bio tab - only show for allowed users
              ...(hasBioAccess ? [{ key: 'bio', label: 'ShoutOut Bio ✨', count: null, icon: LinkIcon }] : []),
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
          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Pending Orders</h3>
              <div className="space-y-4">
                {pendingOrders.map((order) => (
                  <div 
                    key={order.id} 
                    id={`order-${order.id}`}
                    className={`glass glow-blue rounded-2xl p-6 border transition-all duration-300 ${
                      highlightedOrderId === order.id 
                        ? 'border-yellow-400 border-2 shadow-lg shadow-yellow-400/50' 
                        : 'border-white/30 hover:glass-strong'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-medium">
                            {order.users.full_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-white flex items-center gap-2">
                            {order.users.full_name}
                            {order.order_type === 'demo' && (
                              <span className="text-xs glass-strong text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/30 font-semibold">
                                🎯 Demo Order
                              </span>
                            )}
                            {order.is_corporate_order && (
                              <span className="text-xs glass-strong text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">
                                🏢 Business
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-300">
                            ${(getOrderDisplayAmount(order) / 100).toFixed(2)} • {new Date(order.created_at).toLocaleDateString()}
                            {order.coupon_code && (
                              <span className="ml-2 text-xs text-green-400">
                                {order.coupon_code.toUpperCase() === 'WINNER100' ? '🎁 Giveaway' : '🏷️ Promo'}
                              </span>
                            )}
                          </p>
                          {order.is_corporate_order && order.approval_status === 'pending' ? (
                            <p className="text-sm text-orange-400 font-medium">
                              ⏳ Awaiting your approval - timer will start when approved
                            </p>
                          ) : (
                            <p className="text-sm text-yellow-400">
                              Due: {new Date(order.fulfillment_deadline).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {order.is_corporate_order && order.approval_status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleApproveOrder(order.id)}
                              className="w-full sm:w-auto bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-xl font-medium hover:from-green-700 hover:to-green-800 shadow-modern transition-all duration-300 flex items-center justify-center gap-2"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectingOrderId(order.id)}
                              className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-xl font-medium hover:from-red-700 hover:to-red-800 shadow-modern transition-all duration-300 flex items-center justify-center gap-2"
                            >
                              <XCircleIcon className="h-4 w-4" />
                              Reject & Refund
                            </button>
                          </>
                        ) : order.status !== 'completed' && order.status !== 'denied' && order.status !== 'cancelled' ? (
                          <>
                            {/* Show Deny button for non-corporate pending/in_progress orders */}
                            <button
                              onClick={() => setRejectingOrderId(order.id)}
                              className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-xl font-medium hover:from-red-700 hover:to-red-800 shadow-modern transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                            >
                              <XCircleIcon className="h-4 w-4" />
                              Deny & Refund
                            </button>
                          </>
                        ) : null}
                        {(order.status === 'pending' || order.status === 'in_progress') && (
                          <button
                            onClick={() => handleAcceptOrder(order.id)}
                            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 shadow-modern transition-all duration-300"
                          >
                            Accept Order
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="glass-strong p-4 rounded-md mb-4 border border-white/20">
                      <h5 className="font-medium text-white mb-2">Request:</h5>
                      {!order.details_submitted ? (
                        <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 text-center">
                          <p className="text-amber-300 font-medium">⏳ Pending details from customer</p>
                          <p className="text-amber-200/70 text-sm mt-1">The customer will fill in their request details soon</p>
                        </div>
                      ) : (
                        <>
                          {order.recipient_name && (
                            <div className="mb-3 pb-3 border-b border-white/10">
                              <span className="text-blue-300 font-medium">Who's it for:</span>
                              <span className="text-white ml-2">{order.recipient_name}</span>
                            </div>
                          )}
                          <p className="text-gray-300 mb-3 whitespace-pre-wrap">{order.request_details}</p>
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-sm text-yellow-300 italic">
                              💡 Always mention <strong>{order.recipient_name || "the person's name"}</strong> in your ShoutOut.
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {order.is_corporate_order && (
                      <div className="glass-subtle border border-blue-200/30 rounded-xl p-4 glow-blue">
                        <h5 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                          🏢 Business Order Context
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {order.company_name && (
                            <div>
                              <span className="font-medium text-blue-800">Company:</span>
                              <p className="text-blue-700">{order.company_name}</p>
                            </div>
                          )}
                          {order.event_description && (
                            <div>
                              <span className="font-medium text-blue-800">Event:</span>
                              <p className="text-blue-700">{order.event_description}</p>
                            </div>
                          )}
                          {order.event_audience && (
                            <div>
                              <span className="font-medium text-blue-800">Audience:</span>
                              <p className="text-blue-700">{order.event_audience}</p>
                            </div>
                          )}
                          {order.video_setting_request && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-blue-800">Setting Request:</span>
                              <p className="text-blue-700">{order.video_setting_request}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* In Progress Orders */}
          {inProgressOrders.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">In Progress</h3>
              <div className="space-y-4">
                {inProgressOrders.map((order) => (
                  <div 
                    key={order.id} 
                    id={`order-${order.id}`}
                    className={`glass glow-blue rounded-2xl p-6 border transition-all duration-300 ${
                      highlightedOrderId === order.id 
                        ? 'border-yellow-400 border-2 shadow-lg shadow-yellow-400/50' 
                        : 'border-white/30 hover:glass-strong'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-medium">
                            {order.users.full_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-white flex items-center gap-2">
                            {order.users.full_name}
                            {order.order_type === 'demo' && (
                              <span className="text-xs glass-strong text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/30 font-semibold">
                                🎯 Demo Order
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-300">
                            ${(getOrderDisplayAmount(order) / 100).toFixed(2)} • {new Date(order.created_at).toLocaleDateString()}
                            {order.coupon_code && (
                              <span className="ml-2 text-xs text-green-400">
                                {order.coupon_code.toUpperCase() === 'WINNER100' ? '🎁 Giveaway' : '🏷️ Promo'}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <label className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 cursor-pointer">
                          {uploadingVideo === order.id ? (
                            <span>Uploading...</span>
                          ) : (
                            <>
                              <CloudArrowUpIcon className="h-4 w-4 inline mr-2" />
                              Upload Video
                            </>
                          )}
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleVideoUpload(order.id, file);
                            }}
                            disabled={uploadingVideo === order.id}
                          />
                        </label>
                        {(() => {
                          const dueDate = new Date(new Date(order.created_at).getTime() + (talentProfile?.fulfillment_time_hours || 72) * 60 * 60 * 1000);
                          const isPastDue = new Date() > dueDate;
                          return isPastDue && (
                            <span className="text-xs text-yellow-400">
                              ⏰ Past due - upload still accepted
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="glass-strong p-4 rounded-md border border-white/20">
                      <h5 className="font-medium text-white mb-2">Request:</h5>
                      {order.recipient_name && (
                        <div className="mb-3 pb-3 border-b border-white/10">
                          <span className="text-blue-300 font-medium">Who's it for:</span>
                          <span className="text-white ml-2">{order.recipient_name}</span>
                        </div>
                      )}
                      <p className="text-gray-300 mb-3 whitespace-pre-wrap">{order.request_details}</p>
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-sm text-yellow-300 italic">
                          💡 Always mention <strong>{order.recipient_name || "the person's name"}</strong> in your ShoutOut.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Orders */}
          {completedOrders.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Completed Orders</h3>
              <div className="space-y-4">
                {completedOrders.map((order) => {
                  const orderReview = reviews.find(r => r.order_id === order.id);
                  return (
                    <div 
                      key={order.id} 
                      id={`order-${order.id}`}
                      className={`glass rounded-2xl p-6 border transition-all duration-300 ${
                        highlightedOrderId === order.id 
                          ? 'border-yellow-400 border-2 shadow-lg shadow-yellow-400/50' 
                          : 'border-white/30 hover:glass-strong'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-medium">
                              {order.users.full_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-white flex items-center gap-2">
                              {order.users.full_name}
                              {order.order_type === 'demo' && (
                                <span className="text-xs glass-strong text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/30 font-semibold">
                                  🎯 Demo Order
                                </span>
                              )}
                            </h4>
                            <div className="space-y-1">
                              <p className="text-sm text-gray-300">
                                ${(getOrderDisplayAmount(order) / 100).toFixed(2)} • {new Date(order.created_at).toLocaleDateString()}
                                {order.coupon_code && (
                                  <span className="ml-2 text-xs text-green-400">
                                    {order.coupon_code.toUpperCase() === 'WINNER100' ? '🎁 Giveaway' : '🏷️ Promo'}
                                  </span>
                                )}
                              </p>
                              {(() => {
                                // Calculate net payout: talent's video price - 25% admin fee
                                const displayAmount = getOrderDisplayAmount(order);
                                const basePrice = displayAmount / 100 / 1.029; // Remove processing fee
                                const adminFeePercentage = talentProfile?.admin_fee_percentage || 25;
                                const netPayout = basePrice - (basePrice * (adminFeePercentage / 100));
                                
                                return (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs text-green-400 font-medium">
                                      Net: ${netPayout.toFixed(2)}
                                    </p>
                                    <span className="text-xs text-gray-400">
                                      ({adminFeePercentage}% platform fee)
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircleIcon className="h-5 w-5 text-green-400" />
                          <span className="text-green-400 text-sm font-medium">Completed</span>
                        </div>
                      </div>

                      {orderReview && (
                        <div className="glass-strong p-4 rounded-md mb-4 border border-green-500/30">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-white">Customer Review:</h5>
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <StarSolid
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < orderReview.rating ? 'text-yellow-400' : 'text-gray-500'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          {orderReview.comment && (
                            <p className="text-gray-300">{orderReview.comment}</p>
                          )}
                        </div>
                      )}

                      <div className="glass-strong p-4 rounded-md border border-white/20">
                        <h5 className="font-medium text-white mb-2">Request:</h5>
                        <p className="text-gray-300 whitespace-pre-wrap">{order.request_details}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {orders.length === 0 && (
            <div className="text-center py-12">
              <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
              <p className="text-gray-600">Orders will appear here when customers book you!</p>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass rounded-2xl shadow-modern p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100">
                  <ClockIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{pendingOrders.length}</p>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl shadow-modern p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-green-100">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{talentProfile.fulfilled_orders}</p>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl shadow-modern p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <StarIcon className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Rating</p>
                  <p className="text-2xl font-bold text-gray-900">{talentProfile.average_rating.toFixed(1)}</p>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl shadow-modern p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-100">
                  <CurrencyDollarIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${(completedOrders.reduce((sum, order) => sum + (getOrderDisplayAmount(order) - Number(order.admin_fee)), 0) / 100).toFixed(0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="glass rounded-2xl shadow-modern border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Performance Metrics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600 mb-2">
                  {completedOrders.length > 0 
                    ? Math.min(100, Math.round((completedOrders.length / Math.max(completedOrders.length, orders.length)) * 100))
                    : 0}%
                </div>
                <div className="text-sm text-gray-600">Completion Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600 mb-2">
                  {talentProfile.average_rating.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Average Rating</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600 mb-2">
                  ${((completedOrders.reduce((sum, order) => sum + (getOrderDisplayAmount(order) - Number(order.admin_fee)), 0) / 100) / completedOrders.length || 0).toFixed(0)}
                </div>
                <div className="text-sm text-gray-600">Avg. Earnings/Order</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600 mb-2">
                  {reviews.length}
                </div>
                <div className="text-sm text-gray-600">Total Reviews</div>
              </div>
            </div>
          </div>

          {/* Recent Reviews */}
          {reviews.length > 0 && (
            <div className="glass rounded-2xl shadow-modern border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reviews</h3>
              <div className="space-y-4">
                {reviews.slice(0, 5).map((review) => (
                  <div key={review.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{review.users.full_name}</span>
                      <div className="flex">
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
                      <p className="text-gray-700 text-sm">{review.comment}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payouts Tab */}
      {activeTab === 'payouts' && (
        <IntegratedPayoutsDashboard />
      )}

      {/* Media Center Tab */}
      {activeTab === 'media' && talentProfile && (
        <MediaCenter
          talentId={talentProfile.id}
          talentUsername={talentProfile.username}
          talentFullName={talentProfile.full_name}
          avatarUrl={user?.avatar_url}
          promoVideoUrl={talentProfile.promo_video_url}
        />
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Sub-tabs for Profile (Mobile) */}
          <div className="md:hidden flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveTab('profile')}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium whitespace-nowrap"
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('payouts')}
              className="px-4 py-2 rounded-lg bg-gray-700 text-white font-medium whitespace-nowrap"
            >
              Payouts
            </button>
          </div>

          <div className="glass rounded-2xl shadow-modern border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Talent Profile</h2>
              <button className="flex items-center space-x-2 text-primary-600 hover:text-primary-700">
                <PencilIcon className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
            </div>

          <div className="space-y-6">
            {/* Profile Photo Section */}
            <div className="flex items-center space-x-6 pb-6 border-b border-gray-200">
              <ProfilePictureUpload
                currentAvatarUrl={user?.avatar_url}
                onUploadComplete={async (url) => {
                  try {
                    // The ProfilePictureUpload component handles the database update
                    // Just refresh the local data
                    await fetchTalentData();
                  } catch (error) {
                    console.error('Error refreshing data:', error);
                  }
                }}
                size="lg"
              />
              <div>
                <h3 className="text-lg font-medium text-gray-900">Profile Photo</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Upload a professional headshot for your talent profile
                </p>
                <p className="text-xs text-gray-500">
                  Recommended: 400x400px, JPG or PNG format, max 5MB
                </p>
              </div>
            </div>

            {/* Full Name Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={talentProfile.full_name || ''}
                onChange={(e) => setTalentProfile({ ...talentProfile, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="John Smith"
              />
              <p className="text-xs text-gray-500 mt-1">
                Your legal name (used for payouts and verification)
              </p>
            </div>

            {/* Phone Number Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                value={userHasPhone && userPhone ? userPhone : ''}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '');
                  if (cleaned.length <= 10) {
                    let formatted = cleaned;
                    if (cleaned.length > 6) {
                      formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
                    } else if (cleaned.length > 3) {
                      formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
                    } else if (cleaned.length > 0) {
                      formatted = `(${cleaned}`;
                    }
                    setUserPhone(formatted);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="(555) 123-4567"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used for account security (MFA) and payout notifications
              </p>
            </div>

            {/* Bio Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                rows={4}
                value={talentProfile.bio}
                onChange={(e) => setTalentProfile({ ...talentProfile, bio: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Tell customers about yourself and what makes your ShoutOuts special..."
              />
              <p className="text-xs text-gray-500 mt-1">
                This appears on your public profile and talent cards
              </p>
            </div>

            {/* Pricing Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal Pricing ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={talentProfile.pricing}
                  onChange={(e) => setTalentProfile({ ...talentProfile, pricing: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">For individual customers</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Corporate Pricing ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={talentProfile.corporate_pricing || talentProfile.pricing * 1.5}
                  onChange={(e) => setTalentProfile({ ...talentProfile, corporate_pricing: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">For business customers</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fulfillment Time (hours)
                </label>
                <input
                  type="number"
                  value={talentProfile.fulfillment_time_hours}
                  onChange={(e) => setTalentProfile({ ...talentProfile, fulfillment_time_hours: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* Category Selector */}
            <div className="pt-6 border-t border-gray-200">
              <CategorySelector
                selectedCategories={talentProfile.categories || [talentProfile.category]}
                onCategoryChange={async (categories) => {
                  try {
                    const { error } = await supabase
                      .from('talent_profiles')
                      .update({ 
                        categories: categories,
                        category: categories[0] // Keep primary category for backwards compatibility
                      })
                      .eq('id', talentProfile.id);

                    if (error) throw error;
                    
                    // Update local state
                    setTalentProfile(prev => prev ? { 
                      ...prev, 
                      categories: categories,
                      category: categories[0] 
                    } : null);
                    toast.success('Categories updated successfully!');
                  } catch (error) {
                    console.error('Error updating categories:', error);
                    toast.error('Failed to update categories');
                  }
                }}
              />
            </div>

            {/* Social Media Accounts */}
            <div className="pt-6 border-t border-gray-200">
              <SocialAccountsManager talentId={talentProfile.id} />
            </div>

            {/* Charity Settings */}
            <div className="pt-6 border-t border-gray-200">
              <CharitySelector
                selectedCharityName={talentProfile.charity_name}
                charityPercentage={talentProfile.charity_percentage}
                onCharityChange={async (charityName, percentage) => {
                  try {
                    const { error } = await supabase
                      .from('talent_profiles')
                      .update({ 
                        charity_name: charityName,
                        charity_percentage: percentage 
                      })
                      .eq('id', talentProfile.id);

                    if (error) throw error;
                    
                    // Update local state
                    setTalentProfile(prev => prev ? { 
                      ...prev, 
                      charity_name: charityName,
                      charity_percentage: percentage 
                    } : null);
                    toast.success('Charity settings updated successfully!');
                  } catch (error) {
                    console.error('Error updating charity settings:', error);
                    toast.error('Failed to update charity settings');
                  }
                }}
              />
            </div>

            {/* Security Settings - MFA */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
              <MFASettings />
            </div>

            <div className="pt-6">
              <button 
                onClick={async () => {
                  try {
                    // Update talent profile
                    const { error: profileError } = await supabase
                      .from('talent_profiles')
                      .update({
                        full_name: talentProfile.full_name,
                        bio: talentProfile.bio,
                        pricing: talentProfile.pricing,
                        corporate_pricing: talentProfile.corporate_pricing,
                        fulfillment_time_hours: talentProfile.fulfillment_time_hours,
                      })
                      .eq('id', talentProfile.id);

                    if (profileError) throw profileError;

                    // Update phone number in users table if changed
                    if (userPhone) {
                      const formattedPhone = `+1${userPhone.replace(/\D/g, '')}`;
                      const { error: phoneError } = await supabase
                        .from('users')
                        .update({ phone: formattedPhone })
                        .eq('id', user?.id);

                      if (phoneError) throw phoneError;
                    }

                    toast.success('Profile updated successfully!');
                    await fetchTalentData(); // Refresh data
                  } catch (error: any) {
                    console.error('Error updating profile:', error);
                    toast.error(error.message || 'Failed to update profile');
                  }
                }}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-2xl font-medium hover:from-blue-700 hover:to-blue-800 shadow-modern hover:shadow-modern-lg transition-all duration-300"
              >
                Update Profile
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingOrderId && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-95 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <XCircleIcon className="h-6 w-6 text-red-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">
                Deny Order & Process Refund
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for denying this order. The customer will be notified and automatically refunded via email and in-app notification.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows={4}
              placeholder="Enter rejection reason..."
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  if (rejectionReason.trim()) {
                    handleRejectOrder(rejectingOrderId, rejectionReason.trim());
                    setRejectingOrderId(null);
                    setRejectionReason('');
                  } else {
                    toast.error('Please provide a rejection reason');
                  }
                }}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Deny & Refund
              </button>
              <button
                onClick={() => {
                  setRejectingOrderId(null);
                  setRejectionReason('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bio Tab - Only for allowed users */}
      {activeTab === 'bio' && hasBioAccess && (
        <div className="space-y-6">
          <div className="glass border border-white/20 rounded-2xl p-8 text-center">
            <LinkIcon className="h-16 w-16 text-blue-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">ShoutOut Bio</h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              Create your personalized link-in-bio page at bio.shoutout.us/{talentProfile?.username || 'yourname'}
            </p>
            <a
              href={`https://bio.shoutout.us/dashboard?token=${encodeURIComponent(user?.id || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              <LinkIcon className="h-5 w-5" />
              Open Bio Dashboard
            </a>
            <p className="text-sm text-gray-500 mt-4">
              Opens in a new tab at bio.shoutout.us
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default TalentDashboard;
