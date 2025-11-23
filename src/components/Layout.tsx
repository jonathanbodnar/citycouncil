import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import MobileNavigation from './MobileNavigation';
import Footer from './Footer';
import SupportChatWidget from './SupportChatWidget';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col">
      <Header />
      <main className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileNavigation />
      <SupportChatWidget showForUserTypes={['talent']} />
    </div>
  );
};

export default Layout;
