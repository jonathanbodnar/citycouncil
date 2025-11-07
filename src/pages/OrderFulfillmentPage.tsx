import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const OrderFulfillmentPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (token) {
      verifyTokenAndLoadOrder();
    }
  }, [token, user]);

  const verifyTokenAndLoadOrder = async () => {
    try {
      // If user is not logged in, redirect to login FIRST
      // Don't try to verify the token yet (RLS will block it)
      if (!user) {
        console.log('OrderFulfillmentPage: User not logged in, storing token:', token);
        toast('Please log in to fulfill this order', { icon: '🔐' });
        // Store the token in session storage so we can redirect back after login
        if (token) {
          sessionStorage.setItem('fulfillment_redirect_token', token);
          console.log('OrderFulfillmentPage: Token stored in sessionStorage');
          console.log('OrderFulfillmentPage: Verification:', sessionStorage.getItem('fulfillment_redirect_token'));
        }
        navigate('/login');
        setLoading(false);
        return;
      }

      // User is logged in - now lookup order by token
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, talent_profiles!orders_talent_id_fkey(user_id)')
        .eq('fulfillment_token', token)
        .single();

      if (orderError || !orderData) {
        console.error('Order lookup error:', orderError);
        toast.error('Invalid or expired fulfillment link');
        navigate('/');
        return;
      }

      setOrder(orderData);

      // Verify the logged-in user is the talent for this order
      const talentUserId = orderData.talent_profiles?.user_id;
      
      if (user.id !== talentUserId) {
        toast.error('This order is not assigned to you');
        navigate('/');
        return;
      }

      // Redirect to talent dashboard with the order highlighted
      toast.success('Loading your order...');
      navigate(`/dashboard?order=${orderData.id}`);
      
    } catch (error) {
      console.error('Error verifying token:', error);
      toast.error('Failed to load order');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying fulfillment link...</p>
        </div>
      </div>
    );
  }

  return null; // Will redirect, so no need to render anything
};

export default OrderFulfillmentPage;

