import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import { HeartIcon, StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Order, Review, TalentProfile } from '../types';
import ProfilePictureUpload from './ProfilePictureUpload';
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

const TalentDashboard: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [orders, setOrders] = useState<OrderWithUser[]>([]);
  const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'profile'>('orders');
  const [uploadingVideo, setUploadingVideo] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchTalentData();
    }
  }, [user]);

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
      // In a real implementation, this would upload to Wasabi S3
      // For now, we'll simulate the upload and update the order
      
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const videoUrl = `https://example.com/videos/${orderId}.mp4`;
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: 'completed',
          video_url: videoUrl 
        })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Video uploaded successfully!');
      fetchTalentData(); // Refresh data
    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error('Failed to upload video');
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
      const { error } = await supabase
        .from('orders')
        .update({ status: 'in_progress' })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Order accepted! You can now upload the video.');
      fetchTalentData();
    } catch (error) {
      console.error('Error accepting order:', error);
      toast.error('Failed to accept order');
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
          className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700"
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Talent Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.full_name}!</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
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

        <div className="bg-white rounded-lg shadow-sm p-6">
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

        <div className="bg-white rounded-lg shadow-sm p-6">
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

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-100">
              <CurrencyDollarIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Earnings</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(completedOrders.reduce((sum, order) => sum + (order.amount - order.admin_fee), 0)).toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Analytics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Performance Analytics</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">
              {((talentProfile.fulfilled_orders / talentProfile.total_orders) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Fulfillment Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">
              {talentProfile.average_rating.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Average Rating</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">
              ${((completedOrders.reduce((sum, order) => sum + (order.amount - order.admin_fee), 0)) / completedOrders.length || 0).toFixed(0)}
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

        {/* Recent Reviews Section */}
        {reviews.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reviews</h3>
            <div className="space-y-4">
              {reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="border border-gray-200 rounded-lg p-4">
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

      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'orders', label: 'Orders', count: orders.length },
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
          {/* Pending Orders */}
          {pendingOrders.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Orders</h3>
              <div className="space-y-4">
                {pendingOrders.map((order) => (
                  <div key={order.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-medium">
                            {order.users.full_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{order.users.full_name}</h4>
                          <p className="text-sm text-gray-600">
                            ${order.amount.toFixed(2)} • {new Date(order.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-yellow-700">
                            Due: {new Date(order.fulfillment_deadline).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAcceptOrder(order.id)}
                        className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
                      >
                        Accept Order
                      </button>
                    </div>
                    <div className="bg-white p-4 rounded-md">
                      <h5 className="font-medium text-gray-900 mb-2">Request:</h5>
                      <p className="text-gray-700">{order.request_details}</p>
                    </div>
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
                  <div key={order.id} className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-medium">
                            {order.users.full_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{order.users.full_name}</h4>
                          <p className="text-sm text-gray-600">
                            ${order.amount.toFixed(2)} • {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
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
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-md">
                      <h5 className="font-medium text-gray-900 mb-2">Request:</h5>
                      <p className="text-gray-700">{order.request_details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Orders */}
          {completedOrders.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Completed Orders</h3>
              <div className="space-y-4">
                {completedOrders.map((order) => {
                  const orderReview = reviews.find(r => r.order_id === order.id);
                  return (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-medium">
                              {order.users.full_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{order.users.full_name}</h4>
                            <p className="text-sm text-gray-600">
                              ${order.amount.toFixed(2)} • {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CheckCircleIcon className="h-5 w-5 text-green-600" />
                          <span className="text-green-800 text-sm font-medium">Completed</span>
                        </div>
                      </div>

                      {orderReview && (
                        <div className="bg-green-50 p-4 rounded-md mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-900">Customer Review:</h5>
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <StarSolid
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < orderReview.rating ? 'text-yellow-400' : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          {orderReview.comment && (
                            <p className="text-gray-700">{orderReview.comment}</p>
                          )}
                        </div>
                      )}

                      <div className="bg-gray-50 p-4 rounded-md">
                        <h5 className="font-medium text-gray-900 mb-2">Request:</h5>
                        <p className="text-gray-700">{order.request_details}</p>
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

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={talentProfile.category}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal Pricing ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={talentProfile.pricing}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Charity Donation %
                </label>
                <input
                  type="number"
                  value={talentProfile.charity_percentage || 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio
              </label>
              <textarea
                rows={4}
                value={talentProfile.bio}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {talentProfile.charity_name && (
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <HeartIcon className="h-5 w-5 text-red-500 mr-2" />
                  <span className="font-medium text-red-900">
                    {talentProfile.charity_percentage}% of proceeds go to {talentProfile.charity_name}
                  </span>
                </div>
              </div>
            )}

            <div className="pt-6">
              <button className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700">
                Update Profile
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TalentDashboard;
