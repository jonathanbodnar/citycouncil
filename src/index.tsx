import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import ErrorBoundary from './components/ErrorBoundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { supabase } from './services/supabase';

// Handle magic link authentication from URL hash BEFORE app renders
// This ensures Supabase processes the token before React takes over
if (window.location.hash && window.location.hash.includes('access_token')) {
  console.log('Magic link detected in URL hash, processing...');
  // Supabase will automatically detect and process the hash
  // We just need to make sure getSession is called
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('Error processing magic link:', error);
    } else if (data.session) {
      console.log('Magic link session established:', data.session.user?.email);
      // Clear the hash from URL for cleaner appearance
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  });
}

// Clear chunk error reload flag on successful app load
// This prevents the flag from persisting after a successful reload
try {
  sessionStorage.removeItem('chunk_error_reload');
} catch (e) {
  // sessionStorage not available
}

// Create a client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Cache kept for 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on window focus (can be annoying)
      refetchOnReconnect: true, // Refetch when internet reconnects
      retry: 1, // Retry failed queries once
    },
  },
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
