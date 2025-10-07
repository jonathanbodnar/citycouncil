import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import MobileNavigation from './MobileNavigation';
import Footer from './Footer';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pb-16 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileNavigation />
    </div>
  );
};

export default Layout;
