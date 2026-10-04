import React from 'react';
import { JCBLoader } from './JCBLoader';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'whatsapp' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

/**
 * High-performance, tactile ActionButton tailored for JCB / Construction mobile apps.
 * Features automatic duplicate-click prevention and animated machine loading feedback.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  onClick,
  loading = false,
  loadingText,
  disabled = false,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = true,
  className = '',
  type = 'button',
  ...rest
}) => {
  const isDisabled = disabled || loading;

  const baseStyles = 'inline-flex items-center justify-center font-bold tracking-tight rounded-xl transition-all duration-150 select-none shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none';

  const sizeStyles = {
    sm: 'text-xs px-3 py-2 gap-1.5 min-h-[38px]',
    md: 'text-sm px-4 py-3 gap-2 min-h-[46px]',
    lg: 'text-base px-5 py-3.5 gap-2.5 min-h-[52px]',
  }[size];

  const variantStyles = {
    // Iconic JCB Amber Yellow / Dark Navy text
    primary: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 shadow-amber-500/20 shadow-md',
    // Dark Charcoal / Industrial Slate
    dark: 'bg-slate-900 dark:bg-[#1C2430] hover:bg-slate-800 dark:hover:bg-[#26303D] active:bg-slate-950 dark:active:bg-[#151B23] text-white shadow-slate-900/25 shadow-md border dark:border-[#26303D]',
    // Secondary surface
    secondary: 'bg-slate-100 dark:bg-[#1C2430] hover:bg-slate-200 dark:hover:bg-[#26303D] active:bg-slate-300 dark:active:bg-[#2F3B4B] text-slate-800 dark:text-[#F9FAFB] border border-slate-200 dark:border-[#26303D]',
    // WhatsApp Green
    whatsapp: 'bg-[#25D366] hover:bg-[#20BD5A] active:bg-[#1CAA51] text-white shadow-emerald-500/20 shadow-md',
    // Success Emerald
    success: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20 shadow-md',
    // Danger Rose
    danger: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-rose-600/20 shadow-md',
    // Outline
    outline: 'bg-white dark:bg-[#151B23] hover:bg-slate-50 dark:hover:bg-[#1C2430] active:bg-slate-100 dark:active:bg-[#26303D] text-slate-800 dark:text-[#F9FAFB] border-2 border-slate-200 dark:border-[#26303D]',
  }[variant];

  const widthStyle = fullWidth ? 'w-full' : 'w-auto';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      aria-busy={loading}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
      {...rest}
    >
      {loading ? (
        <JCBLoader
          inline
          text={loadingText || 'Processing...'}
          size={size === 'sm' ? 'sm' : 'md'}
          className={variant === 'primary' ? 'text-slate-950' : 'text-current'}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          <span>{children}</span>
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};
