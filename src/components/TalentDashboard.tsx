import React, { useState, useEffect, useRef } from 'react';
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
  LinkIcon,
  ShieldCheckIcon,
  SparklesIcon,
  GlobeAltIcon,
  MegaphoneIcon,
  ArrowTopRightOnSquareIcon,
  UserGroupIcon,
  VideoCameraIcon,
  ShoppingBagIcon,
  TicketIcon,
  BellIcon,
  ShareIcon,
  HomeIcon,
  DocumentDuplicateIcon,
  RocketLaunchIcon,
  BuildingOfficeIcon
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

// Feature flag: Bio tab controlled by admin via bio_enabled field
// Also show on dev environment for testing
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
  const [activeTab, setActiveTab] = useState<'welcome' | 'orders' | 'analytics' | 'profile' | 'payouts' | 'media' | 'bio'>('welcome');
  const [uploadingVideo, setUploadingVideo] = useState<string | null>(null);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [userHasPhone, setUserHasPhone] = useState(true);
  const [userPhone, setUserPhone] = useState('');
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [christmasModeEnabled, setChristmasModeEnabled] = useState(false);
  const [showCorporateBanner, setShowCorporateBanner] = useState(() => {
    // Check if banner was previously dismissed
    const dismissed = localStorage.getItem('corporate_banner_dismissed');
    return dismissed !== 'true';
  });
  const [showCorporateModal, setShowCorporateModal] = useState(false);
  const [corporatePrice, setCorporatePrice] = useState('');
  const [showExpressBanner, setShowExpressBanner] = useState(() => {
    const dismissed = localStorage.getItem('express_delivery_banner_dismissed');
    return dismissed !== 'true';
  });
  const [enablingExpress, setEnablingExpress] = useState(false);
  const [uploadingPromoVideo, setUploadingPromoVideo] = useState(false);
  
  // Bio carousel ref for auto-scrolling
  const bioCarouselRef = useRef<HTMLDivElement>(null);
  const welcomeCarouselRef = useRef<HTMLDivElement>(null);
  const promoVideoInputRef = useRef<HTMLInputElement>(null);

  // Fetch Christmas mode setting
  useEffect(() => {
    const fetchChristmasMode = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'christmas_mode_enabled')
        .single();
      setChristmasModeEnabled(data?.setting_value === 'true');
    };
    fetchChristmasMode();
  }, []);

  // Check if user has access to Bio feature
  // Show if: bio_enabled is true in admin OR on dev environment for testing
  const hasBioAccess = talentProfile?.bio_enabled === true || IS_DEV_ENVIRONMENT;

  // Handle tab from URL parameter
  const tabParam = searchParams.get('tab');
  useEffect(() => {
    const validTabs = ['welcome', 'orders', 'analytics', 'profile', 'payouts', 'media'];
    if (hasBioAccess) validTabs.push('bio');
    
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam as 'welcome' | 'orders' | 'analytics' | 'profile' | 'payouts' | 'media' | 'bio');
    } else {
      // Default to welcome page when no tab parameter
      setActiveTab('welcome');
    }
  }, [tabParam, hasBioAccess]); // Watch the actual tab value

  // Bio carousel auto-scroll animation
  const bioCreatorBios = [
    { name: 'Chris Ripa', handle: 'chrisripa' },
    { name: 'Greg On Fire', handle: 'gregonfire' },
    { name: 'Shawn Farash', handle: 'shawnfarash' },
    { name: 'Melonie Mac', handle: 'meloniemac' },
    { name: 'Nick Di Paolo', handle: 'nickdipaolo' },
    { name: 'Lydia Shaffer', handle: 'lydiashaffer' },
    { name: 'Kristin Sokoloff', handle: 'kristinsokoloff' },
  ];

  useEffect(() => {
    if (activeTab !== 'bio') return;
    
    let animationId: number;
    let position = 0;
    const speed = 0.4;

    const animate = () => {
      const carousel = bioCarouselRef.current;
      if (!carousel) {
        animationId = requestAnimationFrame(animate);
        return;
      }
      
      position -= speed;
      const cardWidth = 160 + 16; // card width + gap
      if (Math.abs(position) >= cardWidth * bioCreatorBios.length) {
        position = 0;
      }
      carousel.style.transform = `translateX(${position}px)`;
      animationId = requestAnimationFrame(animate);
    };

    // Start animation immediately
    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [activeTab]);

  // Auto-scroll animation for welcome tab carousel
  useEffect(() => {
    if (activeTab !== 'welcome') return;
    
    let animationId: number;
    let position = 0;
    const speed = 0.4;

    const animate = () => {
      const carousel = welcomeCarouselRef.current;
      if (!carousel) {
        animationId = requestAnimationFrame(animate);
        return;
      }
      
      position -= speed;
      const cardWidth = 120 + 12; // card width + gap (smaller cards for welcome)
      if (Math.abs(position) >= cardWidth * bioCreatorBios.length) {
        position = 0;
      }
      carousel.style.transform = `translateX(${position}px)`;
      animationId = requestAnimationFrame(animate);
    };

    // Start animation immediately
    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [activeTab]);

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
      const uploadAttemptInfo = {
        orderId,
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        fileType: file.type,
        talentUsername: talentProfile?.username,
        talentId: talentProfile?.id,
        userId: user?.id,
        timestamp: new Date().toISOString()
      };
      console.log('📹 Video upload starting:', uploadAttemptInfo);

      // Log upload attempt to database for tracking
      try {
        await supabase.from('admin_audit_log').insert({
          action: 'video_upload_started',
          entity_type: 'order',
          entity_id: orderId,
          user_id: user?.id,
          details: {
            talent_username: talentProfile?.username,
            talent_id: talentProfile?.id,
            file_name: file.name,
            file_size_mb: (file.size / 1024 / 1024).toFixed(2),
            file_type: file.type
          }
        });
      } catch (logError) {
        console.warn('Could not log upload start:', logError);
      }

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
      const errorDetails = {
        orderId,
        error: error,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorDetails: error?.details,
        talentUsername: talentProfile?.username,
        talentId: talentProfile?.id,
        userId: user?.id,
        timestamp: new Date().toISOString()
      };
      
      console.error('❌ Video upload error:', errorDetails);
      
      // Log error to database for admin visibility
      try {
        await supabase.from('admin_audit_log').insert({
          action: 'video_upload_error',
          entity_type: 'order',
          entity_id: orderId,
          user_id: user?.id,
          details: {
            error_message: error?.message || error?.toString(),
            error_code: error?.code,
            talent_username: talentProfile?.username,
            talent_id: talentProfile?.id,
            file_info: 'Video upload failed'
          }
        });
        console.log('📝 Error logged to admin_audit_log');
      } catch (logError) {
        console.warn('Could not log error to database:', logError);
      }
      
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

  const dismissCorporateBanner = () => {
    setShowCorporateBanner(false);
    localStorage.setItem('corporate_banner_dismissed', 'true');
  };

  const dismissExpressBanner = () => {
    setShowExpressBanner(false);
    localStorage.setItem('express_delivery_banner_dismissed', 'true');
  };

  const enableExpressDelivery = async () => {
    if (!talentProfile) return;
    setEnablingExpress(true);
    try {
      const expressPrice = Math.round(talentProfile.pricing * 1.2 * 100) / 100;
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          express_delivery_enabled: true,
          express_delivery_price: expressPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', talentProfile.id);

      if (error) throw error;

      setTalentProfile({ ...talentProfile, express_delivery_enabled: true, express_delivery_price: expressPrice });
      dismissExpressBanner();
      toast.success(`24hr Express Delivery enabled at $${expressPrice}!`);
      fetchTalentData();
    } catch (error) {
      console.error('Error enabling express delivery:', error);
      toast.error('Failed to enable express delivery.');
    } finally {
      setEnablingExpress(false);
    }
  };

  const handleUpdatePromoVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !talentProfile || !user?.id) return;

    // Validate file type
    const validExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    const isVideo = file.type.startsWith('video/') || validExtensions.includes(fileExtension);
    
    if (!isVideo) {
      toast.error('Please select a video file (MP4, MOV, WEBM, etc.)');
      return;
    }

    // Validate file size (max 1GB)
    const maxSize = 1000 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Video must be less than 1GB');
      return;
    }

    setUploadingPromoVideo(true);
    try {
      const uploadResult = await uploadVideoToWasabi(file, talentProfile.id);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload video');
      }

      const { error } = await supabase
        .from('talent_profiles')
        .update({ promo_video_url: uploadResult.videoUrl })
        .eq('user_id', user.id);

      if (error) throw error;

      setTalentProfile({ ...talentProfile, promo_video_url: uploadResult.videoUrl });
      toast.success('Promo video updated successfully!');
      
      if (promoVideoInputRef.current) {
        promoVideoInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error updating promo video:', error);
      toast.error(error?.message || 'Failed to update promo video');
    } finally {
      setUploadingPromoVideo(false);
    }
  };

  const saveCorporatePricing = async () => {
    if (!talentProfile) return;
    const price = parseFloat(corporatePrice);
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid corporate price greater than 0.');
      return;
    }
    try {
      const { error } = await supabase
        .from('talent_profiles')
        .update({
          corporate_pricing: price,
          updated_at: new Date().toISOString()
        })
        .eq('id', talentProfile.id);

      if (error) throw error;

      setTalentProfile({ ...talentProfile, corporate_pricing: price });
      setShowCorporateModal(false);
      // Hide banner after setting price and persist dismissal
      dismissCorporateBanner();
      toast.success('Corporate pricing set successfully!');
      fetchTalentData(); // Refresh data
    } catch (error) {
      console.error('Error saving corporate pricing:', error);
      toast.error('Failed to save corporate pricing.');
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
  const deniedOrders = orders.filter(o => o.status === 'denied' || o.status === 'cancelled' || o.status === 'refunded');

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

      {/* Christmas Games Banner - Only show when Christmas mode is enabled */}
      {christmasModeEnabled && talentProfile && (
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

      {/* Payout Setup Reminder Banner - Only show on orders tab */}
      {activeTab === 'orders' && talentProfile && !talentProfile.payout_onboarding_completed && (
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

      {/* Corporate Pricing Banner */}
      {showCorporateBanner && talentProfile && talentProfile.corporate_pricing == null && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-500/20">
                <BanknotesIcon className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Corporate event ShoutOut pricing is now live!</h3>
                <p className="text-sm text-gray-300">Set a custom price for business/corporate event ShoutOuts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCorporateModal(true)}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
              >
                Set Corporate Price
              </button>
              <button
                onClick={dismissCorporateBanner}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Dismiss"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation - Hidden on Mobile */}
      <div className="mb-8 hidden md:block">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'welcome', label: 'Welcome', count: null, icon: HomeIcon },
              { key: 'orders', label: 'Orders', count: orders.length },
              { key: 'analytics', label: 'Analytics', count: null },
              { key: 'media', label: 'Promote', count: null },
              { key: 'payouts', label: 'Payouts', count: null, icon: BanknotesIcon },
              { key: 'profile', label: 'Profile Settings', count: null },
              // Bio tab - only show for allowed users
              ...(hasBioAccess ? [{ key: 'bio', label: 'Link In Bio', count: null, customIcon: '/whiteicon.png' }] : []),
            ].map((tab: any) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.customIcon && (
                  <img src={tab.customIcon} alt="" className="h-4 w-4" />
                )}
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


      {/* Welcome Tab */}
      {activeTab === 'welcome' && talentProfile && (
        <div className="space-y-4 sm:space-y-6">
          {/* 24hr Express Delivery Banner - Inside Welcome Tab */}
          {showExpressBanner && !talentProfile.express_delivery_enabled && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-emerald-500/20">
                    <ClockIcon className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Make 20% more per video with 24hr Express Delivery!</h3>
                    <p className="text-sm text-gray-300">Drive demand by adding a rush delivery option at ${talentProfile?.pricing ? Math.round(talentProfile.pricing * 1.2) : '---'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={enableExpressDelivery}
                    disabled={enablingExpress}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {enablingExpress ? 'Enabling...' : 'Add 24hr Delivery'}
                  </button>
                  <button
                    onClick={dismissExpressBanner}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    title="Dismiss"
                  >
                    <XCircleIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Welcome Header - Styled title like /creators */}
          <div className="text-center py-4 sm:py-6">
            <h1 className="text-lg sm:text-xl font-bold text-white leading-tight max-w-[600px] mx-auto">
              How ShoutOut enables you to transform your audience into a{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">monetizable</span>,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400">uncancellable</span>
              {' '}engine that fuels your growth.
            </h1>
          </div>

          {/* Section 1: Kickstart Monetization */}
          <div className="glass border border-white/20 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                <VideoCameraIcon className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Kickstart monetization through personalized videos</h3>
                <p className="text-xs text-emerald-400 font-medium">+10% earnings from orders with your link</p>
              </div>
            </div>

            {/* Copy Profile Link */}
            <div 
              className="mt-4 mb-4 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 cursor-pointer hover:border-emerald-400/40 transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(`https://shoutout.us/${talentProfile?.username || ''}?utm=1`);
                toast.success('Profile link copied!');
              }}
            >
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span className="text-white font-medium text-sm">
                  shoutout.us/{talentProfile?.username || 'yourname'}?utm=1
                </span>
                <DocumentDuplicateIcon className="h-4 w-4 text-emerald-400 ml-auto" />
              </div>
            </div>

            {/* Most Effective Way to Get Orders */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShareIcon className="h-4 w-4 text-pink-400" />
                <span className="text-sm font-semibold text-white">Most effective way to get orders</span>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-r from-pink-500/10 to-orange-500/10 border border-pink-500/20 mb-3">
                <p className="text-gray-200 text-sm leading-relaxed">
                  Post a funny story or previously delivered ShoutOut on Instagram (as a reel or just a story) and{' '}
                  <strong className="text-white">add your profile link on the story.</strong>
                </p>
              </div>
              
              {/* Case Study */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-gray-300 leading-relaxed">
                  <span className="text-emerald-400 font-semibold">Kaitlin Bennett</span> posted a single story on Instagram with her profile link and got{' '}
                  <span className="text-yellow-400 font-bold bg-yellow-400/10 px-1 rounded">10 orders</span> in the first{' '}
                  <span className="text-emerald-400 font-bold bg-emerald-400/10 px-1 rounded">24 hours</span>.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Replace Linktree */}
          <div className="glass border border-white/20 rounded-2xl p-4 sm:p-6">
            <div className="mb-4">
              <p className="text-sm sm:text-base font-medium text-white leading-relaxed mb-3">
                Replace linktree (and other bulky, low conversion bio links) on your social media for free, with your{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-bold">ShoutOut Fans</span>
                {' '}link driving your massive audience into an{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 font-semibold">uncancellable audience</span>.
              </p>
              <button
                onClick={() => setActiveTab('bio')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors text-sm font-medium"
              >
                <img src="/whiteicon.png" alt="ShoutOut" className="h-4 w-4" />
                Check it Out
              </button>
            </div>

            {/* Bio Link Examples Carousel - Auto-scrolling */}
            <div className="relative -mx-4 sm:-mx-6 overflow-hidden mb-4">
              <div className="absolute left-0 w-12 sm:w-16 bg-gradient-to-r from-[#1a1a2e] to-transparent z-10 pointer-events-none" style={{ top: 0, bottom: '16px' }} />
              <div className="absolute right-0 w-12 sm:w-16 bg-gradient-to-l from-[#1a1a2e] to-transparent z-10 pointer-events-none" style={{ top: 0, bottom: '16px' }} />
              
              <div className="overflow-x-clip overflow-y-visible pb-4">
                <div 
                  ref={welcomeCarouselRef}
                  className="flex gap-3"
                  style={{ width: 'max-content' }}
                >
                  {/* Duplicate for seamless loop */}
                  {[...bioCreatorBios, ...bioCreatorBios, ...bioCreatorBios].map((creator, index) => (
                    <div key={index} className="flex-shrink-0 w-[120px]">
                      <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#1a1a2e]" style={{ boxShadow: '0 15px 30px -8px rgba(0, 0, 0, 0.4)' }}>
                        <div className="relative w-full h-[220px] overflow-hidden">
                          <iframe
                            src={`https://shoutout.fans/${creator.handle}`}
                            title={`${creator.name}'s bio`}
                            className="border-0 rounded-xl origin-top-left pointer-events-none"
                            loading="lazy"
                            scrolling="no"
                            style={{
                              width: '375px',
                              height: '667px',
                              transform: 'scale(0.32)',
                              transformOrigin: 'top left',
                            }}
                          />
                          <div className="absolute inset-0 cursor-default" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="font-medium text-[10px] text-white text-center">{creator.name}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Services List */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Your ShoutOut Fans link includes your ShoutOut profile and exclusive ways to monetize:</p>
              <div className="space-y-2">
                {[
                  { icon: UserGroupIcon, text: 'Sell social collaborations', subtext: 'make $100-$2000/video', available: true },
                  { icon: BuildingOfficeIcon, text: 'Capture leads for corporate events and deals', subtext: null, available: true },
                  { icon: ShoppingBagIcon, text: 'Sell Merch', subtext: 'coming soon', available: false },
                  { icon: TicketIcon, text: 'Sell Event Tickets', subtext: 'coming soon', available: false },
                ].map((service, i) => (
                  <div key={i} className={`flex items-center gap-3 p-2 rounded-lg ${service.available ? 'bg-emerald-500/10' : 'bg-white/5'}`}>
                    <service.icon className={`h-4 w-4 ${service.available ? 'text-emerald-400' : 'text-gray-500'}`} />
                    <span className={`text-sm ${service.available ? 'text-white' : 'text-gray-400'}`}>
                      {service.text}
                      {service.subtext && (
                        <span className={`ml-1 ${service.available ? 'text-emerald-400' : 'text-gray-500'} text-xs`}>
                          ({service.subtext})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-gray-400 text-xs mt-3">All your services run through your ShoutOut profile with no additional setup required.</p>
            </div>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Empty State - No Orders Yet */}
          {pendingOrders.length === 0 && completedOrders.length === 0 && (
            <div className="glass rounded-2xl p-8 border border-white/20 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <BellIcon className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No orders yet</h3>
              <p className="text-gray-300 mb-6 max-w-md mx-auto">
                When you receive an order, we'll text you! In the meantime, don't forget to promote your profile!
              </p>
              <button
                onClick={() => setActiveTab('media')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-xl transition-all duration-300 shadow-lg"
              >
                <ShareIcon className="h-5 w-5" />
                Go to Promote Tab
              </button>
              <p className="text-emerald-400 text-sm mt-3 font-medium">
                Promoting increases order rates by over 300%
              </p>
            </div>
          )}

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
                          <h4 className="font-semibold text-white flex items-center gap-2 flex-wrap">
                            {order.users.full_name}
                            {order.order_type === 'demo' && (
                              <span className="text-xs glass-strong text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/30 font-semibold">
                                🎯 Demo Order
                              </span>
                            )}
                            {(order as any).service_type === 'social_collab' && (
                              <span className="text-xs glass-strong text-pink-400 px-2 py-1 rounded-full border border-pink-500/30 font-semibold">
                                📸 Social Collab
                              </span>
                            )}
                            {order.is_corporate_order && (order as any).service_type !== 'social_collab' && (
                              <span className="text-xs glass-strong text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">
                                Event
                              </span>
                            )}
                            {order.is_express_delivery && (
                              <span className="text-xs glass-strong text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/30 font-semibold">
                                ⚡ 24hr Delivery
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
                        {/* Corporate approval buttons - NOT for social collabs (they're auto-approved) */}
                        {order.is_corporate_order && order.approval_status === 'pending' && (order as any).service_type !== 'social_collab' ? (
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
                            {/* Show Deny button for pending/in_progress orders */}
                            <button
                              onClick={() => setRejectingOrderId(order.id)}
                              className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-xl font-medium hover:from-red-700 hover:to-red-800 shadow-modern transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                            >
                              <XCircleIcon className="h-4 w-4" />
                              Deny & Refund
                            </button>
                          </>
                        ) : null}
                        {/* Accept Order button - only show if NOT a corporate order awaiting approval */}
                        {(order.status === 'pending' || order.status === 'in_progress') && 
                         !(order.is_corporate_order && order.approval_status === 'pending') && (
                          <button
                            onClick={() => handleAcceptOrder(order.id)}
                            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 shadow-modern transition-all duration-300"
                          >
                            Accept Order
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Request section - only show for non-collab orders */}
                    {(order as any).service_type !== 'social_collab' && (
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
                              <span className="text-white ml-2 font-semibold">{order.recipient_name}</span>
                            </div>
                          )}
                          {order.request_details && (
                            <div className="mb-3">
                              <span className="text-blue-300 font-medium block mb-2">Things to mention:</span>
                              {/* For corporate orders, preserve formatting. For regular orders, number each line */}
                              {order.is_corporate_order ? (
                                <div className="text-gray-300 whitespace-pre-wrap">{order.request_details}</div>
                              ) : order.request_details.includes('\n') ? (
                                <ul className="space-y-2">
                                  {order.request_details.split('\n').filter(Boolean).map((mention, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-gray-300">
                                      <span className="text-purple-400 font-semibold">{idx + 1}.</span>
                                      <span>{mention}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-gray-300 whitespace-pre-wrap">{order.request_details}</p>
                              )}
                            </div>
                          )}
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-sm text-yellow-300 italic">
                              💡 Always mention <strong>{order.recipient_name || "the person's name"}</strong> in your ShoutOut.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    )}

                    {/* Social Collab Order Details */}
                    {(order as any).service_type === 'social_collab' && (
                      <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-xl p-4">
                        <h5 className="font-medium text-white mb-3 flex items-center gap-2">
                          📸 Social Collab Details
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {/* Customer Social Handles - Click to Copy */}
                          {(order as any).customer_socials && Object.keys((order as any).customer_socials).length > 0 && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-pink-300 block mb-2">Customer Social Handles:</span>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries((order as any).customer_socials).map(([platform, handle]) => {
                                  const platformIcons: Record<string, string> = {
                                    instagram: '📸',
                                    tiktok: '🎵',
                                    youtube: '▶️',
                                    twitter: '🐦',
                                    facebook: '👤'
                                  };
                                  const platformNames: Record<string, string> = {
                                    instagram: 'Instagram',
                                    tiktok: 'TikTok',
                                    youtube: 'YouTube',
                                    twitter: 'Twitter/X',
                                    facebook: 'Facebook'
                                  };
                                  return (
                                    <button
                                      key={platform}
                                      onClick={() => {
                                        navigator.clipboard.writeText(handle as string);
                                        toast.success(`Copied @${handle} to clipboard!`);
                                      }}
                                      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-2 transition-colors group"
                                      title={`Click to copy @${handle}`}
                                    >
                                      <span>{platformIcons[platform] || '🔗'}</span>
                                      <span className="text-white font-medium">@{handle as string}</span>
                                      <span className="text-xs text-gray-400 group-hover:text-pink-300">
                                        {platformNames[platform] || platform}
                                      </span>
                                      <svg className="w-4 h-4 text-gray-400 group-hover:text-pink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {order.company_name && (
                            <div>
                              <span className="font-medium text-pink-300">Brand/Company:</span>
                              <p className="text-gray-200">{order.company_name}</p>
                            </div>
                          )}
                          {(order as any).target_audience && (
                            <div>
                              <span className="font-medium text-pink-300">Target Audience:</span>
                              <p className="text-gray-200">{(order as any).target_audience}</p>
                            </div>
                          )}
                          {(order as any).suggested_script && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-pink-300">Suggested Script:</span>
                              <p className="text-gray-200 whitespace-pre-wrap">{(order as any).suggested_script}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Business Order Details (non-collab) */}
                    {order.is_corporate_order && (order as any).service_type !== 'social_collab' && (
                      <div className="glass-subtle border border-blue-200/30 rounded-xl p-4 glow-blue">
                        <h5 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                          🏢 Event Details
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
                            {(order as any).service_type === 'social_collab' && (
                              <span className="text-xs glass-strong text-pink-400 px-2 py-1 rounded-full border border-pink-500/30 font-semibold">
                                📸 Social Collab
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
                    {/* Regular order request details - only show for non-collab orders */}
                    {(order as any).service_type !== 'social_collab' && (
                    <div className="glass-strong p-4 rounded-md border border-white/20">
                      <h5 className="font-medium text-white mb-2">Request:</h5>
                      {order.recipient_name && (
                        <div className="mb-3 pb-3 border-b border-white/10">
                          <span className="text-blue-300 font-medium">Who's it for:</span>
                          <span className="text-white ml-2 font-semibold">{order.recipient_name}</span>
                        </div>
                      )}
                      {order.request_details && (
                        <div className="mb-3">
                          <span className="text-blue-300 font-medium block mb-2">Things to mention:</span>
                          {/* For corporate orders, preserve formatting. For regular orders, number each line */}
                          {order.is_corporate_order ? (
                            <div className="text-gray-300 whitespace-pre-wrap">{order.request_details}</div>
                          ) : order.request_details.includes('\n') ? (
                            <ul className="space-y-2">
                              {order.request_details.split('\n').filter(Boolean).map((mention, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-gray-300">
                                  <span className="text-purple-400 font-semibold">{idx + 1}.</span>
                                  <span>{mention}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-300 whitespace-pre-wrap">{order.request_details}</p>
                          )}
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-sm text-yellow-300 italic">
                          💡 Always mention <strong>{order.recipient_name || "the person's name"}</strong> in your ShoutOut.
                        </p>
                      </div>
                    </div>
                    )}

                    {/* Social Collab Order Details - In Progress */}
                    {(order as any).service_type === 'social_collab' && (
                      <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-xl p-4">
                        <h5 className="font-medium text-white mb-3 flex items-center gap-2">
                          📸 Social Collab Details
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {/* Customer Social Handles - Click to Copy */}
                          {(order as any).customer_socials && Object.keys((order as any).customer_socials).length > 0 && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-pink-300 block mb-2">Customer Social Handles:</span>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries((order as any).customer_socials).map(([platform, handle]) => {
                                  const platformIcons: Record<string, string> = {
                                    instagram: '📸',
                                    tiktok: '🎵',
                                    youtube: '▶️',
                                    twitter: '🐦',
                                    facebook: '👤'
                                  };
                                  const platformNames: Record<string, string> = {
                                    instagram: 'Instagram',
                                    tiktok: 'TikTok',
                                    youtube: 'YouTube',
                                    twitter: 'Twitter/X',
                                    facebook: 'Facebook'
                                  };
                                  return (
                                    <button
                                      key={platform}
                                      onClick={() => {
                                        navigator.clipboard.writeText(handle as string);
                                        toast.success(`Copied ${platformNames[platform] || platform} handle!`);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                                      title={`Click to copy ${handle}`}
                                    >
                                      <span>{platformIcons[platform] || '🔗'}</span>
                                      <span className="text-white font-medium">{handle as string}</span>
                                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {(order as any).collab_platforms && (
                            <div>
                              <span className="font-medium text-pink-300">Platforms:</span>
                              <span className="text-white ml-2">{(order as any).collab_platforms.join(', ')}</span>
                            </div>
                          )}
                          {(order as any).collab_content_type && (
                            <div>
                              <span className="font-medium text-pink-300">Content Type:</span>
                              <span className="text-white ml-2">{(order as any).collab_content_type}</span>
                            </div>
                          )}
                          {(order as any).collab_description && (
                            <div className="md:col-span-2">
                              <span className="font-medium text-pink-300">Description:</span>
                              <p className="text-white mt-1">{(order as any).collab_description}</p>
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
                            <h4 className="font-semibold text-white flex items-center gap-2 flex-wrap">
                              {order.users.full_name}
                              {order.order_type === 'demo' && (
                                <span className="text-xs glass-strong text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/30 font-semibold">
                                  🎯 Demo Order
                                </span>
                              )}
                              {order.is_express_delivery && (
                                <span className="text-xs glass-strong text-amber-400 px-2 py-1 rounded-full border border-amber-500/30 font-semibold">
                                  ⚡ 24hr Delivery
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

          {/* Denied/Refunded Orders */}
          {deniedOrders.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Denied/Refunded Orders</h3>
              <div className="space-y-4">
                {deniedOrders.map((order) => (
                  <div 
                    key={order.id} 
                    id={`order-${order.id}`}
                    className="glass rounded-2xl p-6 border border-red-500/30 opacity-75"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-red-600 font-medium">
                            {order.users.full_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-white flex items-center gap-2 flex-wrap">
                            {order.users.full_name}
                            {order.order_type === 'demo' && (
                              <span className="text-xs glass-strong text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/30 font-semibold">
                                🎯 Demo Order
                              </span>
                            )}
                            {(order as any).service_type === 'social_collab' && (
                              <span className="text-xs glass-strong text-pink-400 px-2 py-1 rounded-full border border-pink-500/30 font-semibold">
                                📸 Social Collab
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-400">
                            ${(getOrderDisplayAmount(order) / 100).toFixed(2)} • {new Date(order.created_at).toLocaleDateString()}
                          </p>
                          {(order as any).denial_reason && (
                            <p className="text-sm text-red-300 mt-1">
                              <span className="font-medium">Reason:</span> {(order as any).denial_reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <XCircleIcon className="h-5 w-5 text-red-400" />
                        <span className="text-red-400 text-sm font-medium">
                          {order.status === 'denied' ? 'Denied & Refunded' : order.status === 'cancelled' ? 'Cancelled' : 'Refunded'}
                        </span>
                      </div>
                    </div>

                    {/* Show original request */}
                    {order.request_details && (
                      <div className="glass-strong p-4 rounded-md border border-red-500/20">
                        <h5 className="font-medium text-gray-400 mb-2">Original Request:</h5>
                        <p className="text-gray-400 whitespace-pre-wrap">{order.request_details}</p>
                      </div>
                    )}

                    {/* Greyed out button */}
                    <div className="mt-4 flex justify-end">
                      <button
                        disabled
                        className="bg-gray-600 text-gray-400 px-4 py-2 rounded-xl font-medium cursor-not-allowed flex items-center justify-center gap-2 text-sm opacity-50"
                      >
                        <XCircleIcon className="h-4 w-4" />
                        Already Refunded
                      </button>
                    </div>
                  </div>
                ))}
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
      {activeTab === 'analytics' && talentProfile && (
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
                  <p className="text-2xl font-bold text-gray-900">{talentProfile.fulfilled_orders || 0}</p>
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
                  <p className="text-2xl font-bold text-gray-900">{(talentProfile.average_rating || 0).toFixed(1)}</p>
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
                  {(talentProfile.average_rating || 0).toFixed(1)}
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

      {/* Promote Tab (formerly Media Center) */}
      {activeTab === 'media' && talentProfile && (
        <MediaCenter
          talentId={talentProfile.id}
          talentUsername={talentProfile.username}
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

            {/* Promo Video Section */}
            <div className="pt-6 border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Promo Video</h3>
              <p className="text-sm text-gray-600 mb-4">
                This video appears on your profile page. Upload a short intro video to showcase your personality.
              </p>
              
              {talentProfile.promo_video_url ? (
                <div className="space-y-3">
                  <video 
                    src={talentProfile.promo_video_url} 
                    className="w-full max-w-md h-48 object-cover rounded-lg bg-black"
                    muted
                    preload="metadata"
                    controls
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => promoVideoInputRef.current?.click()}
                      disabled={uploadingPromoVideo}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {uploadingPromoVideo ? (
                        <>
                          <CloudArrowUpIcon className="h-5 w-5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <CloudArrowUpIcon className="h-5 w-5" />
                          Replace Video
                        </>
                      )}
                    </button>
                    <span className="text-xs text-gray-500">MP4, MOV, or WEBM • Max 1GB</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => promoVideoInputRef.current?.click()}
                  disabled={uploadingPromoVideo}
                  className="w-full max-w-md h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploadingPromoVideo ? (
                    <>
                      <CloudArrowUpIcon className="h-8 w-8 text-blue-500 animate-spin" />
                      <span className="text-sm text-blue-600">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <CloudArrowUpIcon className="h-8 w-8 text-gray-400" />
                      <span className="text-sm text-gray-600">Click to upload promo video</span>
                      <span className="text-xs text-gray-500">MP4, MOV, or WEBM • Max 1GB</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={promoVideoInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.webm"
                onChange={handleUpdatePromoVideo}
                className="hidden"
              />
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
                  min="0"
                  value={talentProfile.corporate_pricing || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    // If empty or 0, set to undefined (will become NULL in DB)
                    // This ensures we NEVER send 0 to the database
                    if (!val || val === '0' || parseFloat(val) <= 0) {
                      setTalentProfile({ 
                        ...talentProfile, 
                        corporate_pricing: undefined
                      });
                    } else {
                      const parsed = parseFloat(val);
                      setTalentProfile({ 
                        ...talentProfile, 
                        corporate_pricing: parsed
                      });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Leave empty to disable"
                />
                <p className="text-xs text-gray-500 mt-1">For business customers (optional)</p>
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

            <div className="pt-6 border-t border-gray-200">
              <button 
                onClick={async () => {
                  try {
                    // Update talent profile
                    // Ensure corporate_pricing is either NULL or > 0 (never 0)
                    const corporatePricing = talentProfile.corporate_pricing;
                    const safeCorporatePricing = (corporatePricing && corporatePricing > 0) ? corporatePricing : null;
                    
                    const { error: profileError } = await supabase
                      .from('talent_profiles')
                      .update({
                        full_name: talentProfile.full_name,
                        bio: talentProfile.bio,
                        pricing: talentProfile.pricing,
                        corporate_pricing: safeCorporatePricing,
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
        <div className="space-y-4 sm:space-y-6">
          {/* Header with Dashboard Link */}
          <div className="glass border border-white/20 rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                  <LinkIcon className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <img src="/whiteicon.png" alt="ShoutOut" className="h-5 w-5 sm:h-6 sm:w-6" />
                    Link In Bio
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400">shoutout.fans/{talentProfile?.username || 'yourname'}</p>
                </div>
              </div>
              <a
                href={`https://bio.shoutout.us/dashboard?token=${encodeURIComponent(user?.id || '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                Open Bio Dashboard
              </a>
            </div>
          </div>

          {/* Headline + Value Badges */}
          <div className="text-center">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
              The only{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                free-speech
              </span>
              , commerce-ready bio link for your{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400">
                uncancellable
              </span>
              {' '}audience.
            </h3>
            
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {[
                { icon: ShieldCheckIcon, label: 'Security', color: 'emerald' },
                { icon: SparklesIcon, label: 'Simplicity', color: 'cyan' },
                { icon: GlobeAltIcon, label: 'Sovereignty', color: 'purple' },
              ].map((badge, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full backdrop-blur-xl border transition-all duration-300
                    ${badge.color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/30' : ''}
                    ${badge.color === 'cyan' ? 'bg-cyan-500/10 border-cyan-500/30' : ''}
                    ${badge.color === 'purple' ? 'bg-purple-500/10 border-purple-500/30' : ''}
                  `}
                >
                  <badge.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    badge.color === 'emerald' ? 'text-emerald-400' :
                    badge.color === 'cyan' ? 'text-cyan-400' : 'text-purple-400'
                  }`} />
                  <span className="text-white font-medium text-sm">{badge.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Info Card */}
          <div className="glass rounded-2xl p-4 sm:p-6 border border-white/20">
            <p className="text-base sm:text-lg text-gray-200 leading-relaxed">
              Your link in bio is one of the most powerful tools you have as a creator. <span className="text-white font-semibold">Use it wisely.</span>
            </p>
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-emerald-300 font-semibold text-base flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                Best part? We already built it for you.
              </p>
              <p className="text-gray-300 mt-2 text-sm sm:text-base">
                As a creator on ShoutOut, you have <span className="text-cyan-400 font-bold">our bio link</span> setup and ready to monetize. No additional setup required.
              </p>
            </div>
          </div>

          {/* Creator Bio Examples Carousel - Full width, edge to edge */}
          <div className="relative -mx-4 sm:-mx-6 overflow-hidden">
            <h3 className="text-lg font-bold text-white mb-4 px-4 sm:px-6">See It In Action</h3>
            
            {/* Soft edge fades - contained within carousel area */}
            <div className="absolute left-0 w-16 sm:w-24 bg-gradient-to-r from-[#111827] to-transparent z-10 pointer-events-none" style={{ top: '40px', bottom: '32px' }} />
            <div className="absolute right-0 w-16 sm:w-24 bg-gradient-to-l from-[#111827] to-transparent z-10 pointer-events-none" style={{ top: '40px', bottom: '32px' }} />
            
            <div className="overflow-x-clip overflow-y-visible py-2 pb-8">
              <div 
                ref={bioCarouselRef}
                className="flex gap-4"
                style={{ width: 'max-content' }}
              >
                {/* Duplicate array for seamless loop */}
                {[...bioCreatorBios, ...bioCreatorBios, ...bioCreatorBios, ...bioCreatorBios].map((creator, index) => (
                  <div
                    key={index}
                    className="flex-shrink-0 w-[160px]"
                  >
                    <div className="relative rounded-[1.25rem] overflow-hidden border border-white/10 bg-[#1a1a2e]" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                      {/* Live iframe embed - scaled down to show full mobile view */}
                      <div className="relative w-full h-[320px] overflow-hidden">
                        <iframe
                          src={`https://shoutout.fans/${creator.handle}`}
                          title={`${creator.name}'s bio`}
                          className="border-0 rounded-[1.25rem] origin-top-left pointer-events-none"
                          loading="lazy"
                          scrolling="no"
                          style={{
                            width: '375px',
                            height: '750px',
                            transform: 'scale(0.427)',
                            transformOrigin: 'top left',
                          }}
                        />
                        {/* Click-blocking overlay */}
                        <div className="absolute inset-0 cursor-default" />
                      </div>
                      {/* Name label at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="font-semibold text-xs text-white text-center">{creator.name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Services Section - Grid on desktop */}
          <div className="glass rounded-2xl p-4 sm:p-6 border border-white/20">
            <div className="mb-4">
              <p className="text-cyan-400 font-semibold uppercase tracking-widest text-xs mb-1">Services</p>
              <h3 className="text-lg sm:text-xl font-bold text-white">
                Fuel your platform's{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">growth</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { icon: ShoppingBagIcon, title: 'Sell merch', comingSoon: true },
                { icon: TicketIcon, title: 'Sell tickets', comingSoon: true },
                { icon: UserGroupIcon, title: 'Social collaborations', comingSoon: false },
                { icon: VideoCameraIcon, title: 'ShoutOut orders', comingSoon: false },
              ].map((service, index) => (
                <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <service.icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <span className="text-sm font-medium text-white flex-1">{service.title}</span>
                  {service.comingSoon && (
                    <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Coming Soon</span>
                  )}
                </div>
              ))}
            </div>

            <p className="text-center text-xs sm:text-sm text-gray-400 mt-3">
              …all with <span className="text-emerald-400 font-bold">zero effort</span> and already integrated.
            </p>
          </div>

          {/* Own Your Audience + How It Works Combined */}
          <div className="glass rounded-2xl p-4 sm:p-6 border border-white/20">
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
              {/* Left: Content */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-4">
                  Own your{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400">
                    audience.
                  </span>
                </h3>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="glass rounded-lg p-2 sm:p-3 border border-red-500/20 text-center bg-gradient-to-br from-red-500/5 to-transparent">
                    <div className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
                      ~2.6%
                    </div>
                    <p className="text-gray-400 text-[10px] sm:text-xs leading-tight">of followers see your posts</p>
                  </div>
                  <div className="glass rounded-lg p-2 sm:p-3 border border-emerald-500/40 text-center bg-gradient-to-br from-emerald-500/10 to-teal-500/5">
                    <div className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                      ~6%
                    </div>
                    <p className="text-emerald-300 text-[10px] sm:text-xs leading-tight">become fans with bio link</p>
                  </div>
                </div>

                {/* Key Points - Compact */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500 mt-1.5 animate-pulse" />
                    <p className="text-gray-300 text-xs">
                      Social platforms only show your posts to <span className="text-white font-bold">~2.6% of your followers</span>.
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                    <p className="text-gray-300 text-xs">
                      <span className="text-emerald-400 font-bold">Our bio link</span> turns followers into an owned audience—fast.
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-purple-500/5 border border-purple-500/20">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-500 mt-1.5" />
                    <p className="text-gray-300 text-xs">
                      Convert <span className="text-white font-bold">~6% of profile views</span> into reachable fans on auto pilot.
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                    <p className="text-gray-300 text-xs">
                      Send updates directly—without clunky tools like Mailchimp.
                    </p>
                  </div>
                </div>

                {/* Special Badge */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                    <MegaphoneIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-amber-300 font-bold text-xs sm:text-sm">We build your fan list FOR you!</p>
                    <p className="text-amber-200/70 text-[10px] sm:text-xs">Driving users on ShoutOut to subscribe.</p>
                  </div>
                </div>
              </div>

              {/* Right: Overlapping Images - Desktop only */}
              <div className="relative min-h-[300px] hidden lg:flex items-center justify-center">
                {/* Container for overlapping images */}
                <div className="relative w-full h-full">
                  {/* Send Update - Background/larger image */}
                  <div className="absolute top-8 right-0 w-[75%] rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                    <img 
                      src="/creatorbios/sendupdate.png" 
                      alt="Send update - How creators reach their audience"
                      className="w-full h-auto"
                    />
                  </div>

                  {/* Stay Connected - Floating overlay top-left */}
                  <div className="absolute top-0 left-0 w-[55%] rounded-xl overflow-hidden border-2 border-emerald-500/30 shadow-2xl shadow-black/50 z-10">
                    <img 
                      src="/creatorbios/stayconnected.png" 
                      alt="Stay connected - How fans subscribe"
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile: Side by side images below content */}
            <div className="grid grid-cols-2 gap-3 mt-4 lg:hidden">
              <div className="rounded-lg overflow-hidden border border-emerald-500/30">
                <img 
                  src="/creatorbios/stayconnected.png" 
                  alt="Stay connected - How fans subscribe"
                  className="w-full h-auto"
                />
                <div className="p-2 bg-emerald-500/10">
                  <p className="text-emerald-300 font-semibold text-[10px]">Fans Subscribe</p>
                </div>
              </div>
              <div className="rounded-lg overflow-hidden border border-purple-500/30">
                <img 
                  src="/creatorbios/sendupdate.png" 
                  alt="Send update - How creators reach their audience"
                  className="w-full h-auto"
                />
                <div className="p-2 bg-purple-500/10">
                  <p className="text-purple-300 font-semibold text-[10px]">Send Updates</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="glass rounded-2xl p-4 sm:p-6 border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 text-center">
            <p className="text-gray-300 mb-4 text-sm sm:text-base">
              Ready to take control of your audience?
            </p>
            <a
              href={`https://bio.shoutout.us/dashboard?token=${encodeURIComponent(user?.id || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              <ArrowTopRightOnSquareIcon className="h-5 w-5" />
              Open Bio Dashboard
            </a>
          </div>
        </div>
      )}

      {/* Corporate Pricing Modal */}
      {showCorporateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass border border-white/20 rounded-2xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-4">Set Corporate Pricing</h3>
            <p className="text-gray-400 mb-6">
              Set your custom price for business/corporate event ShoutOuts
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Corporate Price ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={corporatePrice}
                onChange={(e) => setCorporatePrice(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter price (e.g., 150)"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCorporateModal(false)}
                className="flex-1 px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={saveCorporatePricing}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 shadow-modern transition-all duration-300"
              >
                Save Price
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TalentDashboard;
