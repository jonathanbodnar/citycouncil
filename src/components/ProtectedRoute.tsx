import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Get UTM from all possible sources
const getCurrentUtm = (): string | null => {
  try {
    // Try localStorage first
    const localUtm = localStorage.getItem('promo_source_global');
    if (localUtm) return localUtm;
    
    // Try sessionStorage
    const sessionUtm = sessionStorage.getItem('promo_source_global');
    if (sessionUtm) return sessionUtm;
    
    // Try cookie
    const match = document.cookie.match(/(?:^|; )promo_source=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
    
    return null;
  } catch {
    return null;
  }
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredUserType?: 'user' | 'talent' | 'admin';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredUserType 
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to appropriate login page
    // Admin routes go to admin login, others go to regular login
    // Note: /login uses SignupPage component which handles both login AND registration
    if (requiredUserType === 'admin') {
      return <Navigate to="/admin/login" replace />;
    }
    const returnTo = encodeURIComponent(location.pathname + location.search);
    
    // Include UTM in redirect URL so it survives the redirect
    const utm = getCurrentUtm();
    const utmParam = utm ? `&utm=${encodeURIComponent(utm)}` : '';
    return <Navigate to={`/login?returnTo=${returnTo}${utmParam}`} replace />;
  }

  if (requiredUserType && user.user_type !== requiredUserType) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
