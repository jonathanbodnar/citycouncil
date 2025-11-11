import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { magicAuthService } from '../services/magicAuthService';
import toast from 'react-hot-toast';
import { logger } from '../utils/logger';

const OrderFulfillmentPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const { user, refreshAuth } = useAuth();
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
      // Check for magic auth token in URL
      const magicToken = searchParams.get('auth');
      
      // If user is not logged in but we have a magic token, try auto-login
      if (!user && magicToken) {
        logger.log('🔐 Attempting magic link authentication...');
        const authResult = await magicAuthService.verifyAndConsumeMagicToken(magicToken);
        
        if (authResult) {
          // Get user's email and create an OTP session
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', authResult.userId)
            .single();

          if (userData?.email) {
            // Sign in using Supabase magic link (OTP)
            const { error } = await supabase.auth.signInWithOtp({
              email: userData.email,
              options: {
                shouldCreateUser: false,
              }
            });

            if (!error) {
              toast.success('Authenticated! Loading your order...', { icon: '✨' });
              // Wait a moment for auth to propagate
              await new Promise(resolve => setTimeout(resolve, 1000));
              await refreshAuth?.();
              // Continue to verify order below
            } else {
              logger.error('Magic auth sign-in failed:', error);
              toast.error('Authentication failed. Please log in manually.');
              sessionStorage.setItem('fulfillment_redirect_token', token!);
              navigate('/login');
              return;
            }
          }
        } else {
          logger.log('Invalid or expired magic token');
          toast('Please log in to fulfill this order', { icon: '🔐' });
          sessionStorage.setItem('fulfillment_redirect_token', token!);
          navigate('/login');
          setLoading(false);
          return;
        }
      }
      
      // If user is not logged in and no magic token, redirect to login
      if (!user && !magicToken) {
        logger.log('OrderFulfillmentPage: User not logged in, storing token:', token);
        toast('Please log in to fulfill this order', { icon: '🔐' });
        if (token) {
          sessionStorage.setItem('fulfillment_redirect_token', token);
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

      // Redirect to welcome page (which will then redirect to dashboard with order)
      toast.success('Loading your order...');
      navigate(`/welcome?order=${orderData.id}`);
      
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

