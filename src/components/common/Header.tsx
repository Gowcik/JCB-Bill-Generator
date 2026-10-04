import React from 'react';
import { Menu, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { JCBMachineIcon } from './JCBMachineIcon';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onOpenMenu: () => void;
  isDashboard?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onOpenMenu,
  isDashboard = false,
}) => {
  const navigate = useNavigate();

  return (
    <header 
      className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-slate-800"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between min-h-[54px]">
        
        {/* Left side: Back button or JCB Icon & Title */}
        <div className="flex items-center gap-3 overflow-hidden">
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center min-w-[44px] min-h-[44px]"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0 p-1 shadow-xs">
              <JCBMachineIcon width={26} height={20} />
            </div>
          )}

          <div className="min-w-0 flex flex-col justify-center">
            {isDashboard ? (
              <>
                <h1 className="text-base font-bold text-white truncate leading-tight">
                  JCB Bill Generator
                </h1>
                {subtitle && (
                  <p className="text-xs text-amber-400 font-semibold truncate leading-normal mt-0.5">
                    {subtitle}
                  </p>
                )}
              </>
            ) : (
              <>
                <h1 className="text-base font-bold text-white truncate leading-tight">
                  {title || 'JCB Bill Generator'}
                </h1>
                {subtitle && (
                  <p className="text-xs text-slate-400 truncate leading-normal mt-0.5">
                    {subtitle}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right side: Three-line hamburger menu button */}
        <button
          onClick={onOpenMenu}
          className="p-2 -mr-1 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-500/50 min-w-[44px] min-h-[44px]"
          aria-label="Open navigation menu"
          title="Open Menu"
        >
          {/* Classic 3-line hamburger icon */}
          <Menu className="w-7 h-7 stroke-[2.2]" />
        </button>
      </div>
    </header>
  );
};
