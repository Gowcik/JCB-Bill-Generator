import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  X, 
  LayoutDashboard, 
  FilePlus, 
  ReceiptText, 
  Users, 
  TrendingUp, 
  UserCheck, 
  Settings, 
  LogOut, 
  LogIn,
  User as UserIcon
} from 'lucide-react';
import { JCBMachineIcon } from './JCBMachineIcon';
import { mockOwnerProfile } from '../../data/mockData';
import { useAuth } from '../../hooks/useAuth';
import { useI18n } from '../../i18n';
import { useBackButton } from '../../hooks/useBackButton';
import { NewBillTypeModal } from '../bills/NewBillTypeModal';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({ isOpen, onClose }) => {
  useBackButton(isOpen, onClose);
  const { user, profile, ownerDetails, isAuthenticated, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);

  if (!isOpen && !isTypeModalOpen) return null;

  const navItems = [
    { label: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
    { label: t('nav.createBill'), path: '/create-bill', icon: FilePlus, highlight: true },
    { label: t('nav.billHistory'), path: '/bill-history', icon: ReceiptText },
    { label: t('nav.customers'), path: '/customers', icon: Users },
    { label: t('nav.reportsTurnover'), path: '/reports', icon: TrendingUp },
    { label: t('nav.ownerDetails'), path: '/owner-details', icon: UserCheck },
    { label: t('nav.settings'), path: '/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    onClose();
    await signOut();
    navigate('/login', { replace: true });
  };

  const businessName = ownerDetails?.business_name || mockOwnerProfile.businessName;
  const displayName = profile?.username || ownerDetails?.owner_name || user?.phone || mockOwnerProfile.ownerName;
  const displayPhone = profile?.mobile_number || ownerDetails?.mobile_number || user?.phone || mockOwnerProfile.phone;
  const machineModel = ownerDetails?.jcb_model || mockOwnerProfile.jcbModel;
  const machineReg = ownerDetails?.registration_number || mockOwnerProfile.jcbRegistrationNumber;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel from right (since hamburger is on top-right) */}
      <div className="fixed inset-y-0 right-0 max-w-xs w-full bg-slate-900 text-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center p-1 shadow-sm">
              <JCBMachineIcon width={30} height={22} />
            </div>
            <div>
              <div className="font-bold text-sm text-amber-400 tracking-wide uppercase">JCB Bill Gen</div>
              <div className="text-xs text-slate-300 font-medium truncate max-w-[170px]">
                {businessName}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* User Identity / Machine Card */}
        <div className="p-3.5 mx-4 mt-4 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs space-y-2">
          {isAuthenticated && (
            <div className="flex items-center gap-2 pb-2 border-b border-slate-700/60">
              <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white truncate">{displayName}</div>
                <div className="text-[11px] text-slate-400 font-mono">{displayPhone}</div>
              </div>
            </div>
          )}

          <div>
            <div className="text-slate-400 font-medium">{t('dashboard.assignedMachine')}</div>
            <div className="text-white font-bold mt-0.5">{machineModel}</div>
            <div className="inline-block mt-1 font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
              {machineReg}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {t('nav.dashboard')}
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={(e) => {
                  if (item.path === '/create-bill') {
                    e.preventDefault();
                    onClose();
                    setIsTypeModalOpen(true);
                  } else {
                    onClose();
                  }
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                      : item.highlight
                      ? 'text-amber-400 hover:bg-slate-800 font-semibold'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-slate-950' : item.highlight ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="flex-1">{item.label}</span>
                    {item.highlight && !isActive && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {t('common.new', 'NEW')}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Logout / Login Item */}
          <div className="pt-2 mt-2 border-t border-slate-800">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
              >
                <LogOut className="w-5 h-5 text-rose-400" />
                <span>{t('nav.logout')}</span>
              </button>
            ) : (
              <NavLink
                to="/login"
                onClick={onClose}
                className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium text-amber-400 hover:bg-slate-800 transition-colors"
              >
                <LogIn className="w-5 h-5 text-amber-400" />
                <span>{t('nav.login')}</span>
              </NavLink>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 text-center">
          <div className="text-xs text-slate-400">
            JCB Bill Generator v1.0
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Developed by Gowcik S
          </div>
        </div>
      </div>
    </div>
      )}

      {/* New Bill Type Selection Modal */}
      <NewBillTypeModal
        isOpen={isTypeModalOpen}
        onClose={() => setIsTypeModalOpen(false)}
      />
    </>
  );
};
