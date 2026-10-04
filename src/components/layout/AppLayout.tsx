import React, { useState } from 'react';
import { Header } from '../common/Header';
import { NavigationDrawer } from '../common/NavigationDrawer';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  isDashboard?: boolean;
  hideBottomNav?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  title,
  subtitle,
  showBack = false,
  isDashboard = false,
  hideBottomNav = false,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F6F8] dark:bg-[#0B0F14] text-[#111827] dark:text-[#F9FAFB] flex flex-col antialiased">
      {/* Top Header with Hamburger on right */}
      <Header
        title={title}
        subtitle={subtitle}
        showBack={showBack}
        isDashboard={isDashboard}
        onOpenMenu={() => setIsDrawerOpen(true)}
      />

      {/* Main Content Area */}
      <main className={`flex-1 w-full max-w-md mx-auto ${hideBottomNav ? 'pb-8' : 'pb-24'} pt-3 px-4`}>
        {children}
      </main>

      {/* Persistent Bottom Bar for mobile convenience */}
      {!hideBottomNav && <BottomNav />}

      {/* Three-line Hamburger Navigation Drawer */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
};
