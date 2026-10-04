import React from 'react';

interface BillSectionProps {
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'amber' | 'dark';
}

/**
 * Reusable visual container for bill invoice sections:
 * Header, Customer Details, Machine Work, Calculation, and Payment.
 */
export const BillSection: React.FC<BillSectionProps> = ({
  title,
  icon,
  subtitle,
  rightAction,
  children,
  className = '',
  variant = 'default',
}) => {
  const variantStyles = {
    default: 'bg-white border-slate-200 shadow-xs',
    amber: 'bg-amber-50/70 border-amber-200 shadow-xs',
    dark: 'bg-slate-900 text-white border-slate-800 shadow-md',
  }[variant];

  const headerTitleColor = variant === 'dark' ? 'text-white' : 'text-slate-800';
  const subtitleColor = variant === 'dark' ? 'text-slate-400' : 'text-slate-400';

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 transition-all ${variantStyles} ${className}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100/80">
        <div className="flex items-center gap-2">
          {icon && <span className="shrink-0 text-amber-500">{icon}</span>}
          <div>
            <h3 className={`text-xs font-black uppercase tracking-wider ${headerTitleColor}`}>
              {title}
            </h3>
            {subtitle && <p className={`text-[11px] ${subtitleColor} mt-0.5`}>{subtitle}</p>}
          </div>
        </div>
        {rightAction && <div>{rightAction}</div>}
      </div>

      {/* Section Body */}
      <div>{children}</div>
    </div>
  );
};
