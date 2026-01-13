import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import BioPage from './pages/BioPage';
import BioDashboard from './pages/BioDashboard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import CollabOrderPage from './pages/CollabOrderPage';
import UnsubscribePage from './pages/UnsubscribePage';

function App() {
  // Redirect from non-www to www for shouts.bio
  React.useEffect(() => {
    if (window.location.hostname === 'shouts.bio') {
      window.location.href = window.location.href.replace('shouts.bio', 'www.shouts.bio');
    }
  }, []);

  return (
    <Router>
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#fff',
            borderRadius: '12px',
          },
        }}
      />
      <Routes>
        {/* Dashboard for editing bio - requires auth token */}
        <Route path="/dashboard" element={<BioDashboard />} />
        {/* Root shows a landing/redirect */}
        <Route path="/" element={<BioLanding />} />
        {/* Unsubscribe page */}
        <Route path="/unsubscribe/:token" element={<UnsubscribePage />} />
        {/* Collab order page */}
        <Route path="/collab/:username/:serviceId" element={<CollabOrderPage />} />
        {/* Privacy policy for each talent */}
        <Route path="/:username/privacy" element={<PrivacyPolicy />} />
        {/* Bio pages at /:username */}
        <Route path="/:username" element={<BioPage />} />
      </Routes>
    </Router>
  );
}

// Simple landing page for bio.shoutout.us root
const BioLanding: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          ShoutOut Bio
        </h1>
        <p className="text-gray-400 mb-8 max-w-md">
          Create your personalized link-in-bio page and connect with your audience.
        </p>
        <a
          href="https://shoutout.us"
          className="inline-block px-8 py-4 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
        >
          Get Started on ShoutOut
        </a>
      </div>
    </div>
  );
};

export default App;

