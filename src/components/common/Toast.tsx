import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id?: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose, className = '' }) => {
  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  const bgStyles = isSuccess
    ? 'bg-slate-900 text-white border-l-4 border-l-emerald-500 shadow-xl'
    : isError
    ? 'bg-slate-900 text-white border-l-4 border-l-rose-500 shadow-xl'
    : 'bg-slate-900 text-white border-l-4 border-l-amber-500 shadow-xl';

  return (
    <div
      role="alert"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-80 w-[92%] max-w-sm p-3.5 rounded-xl border border-slate-700/60 flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200 ${bgStyles} ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        ) : isError ? (
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
        ) : (
          <Info className="w-5 h-5 text-amber-400 shrink-0" />
        )}
        <span className="text-xs font-bold leading-snug truncate-2-lines text-slate-100">
          {toast.message}
        </span>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const SuccessToast: React.FC<{ message: string; onClose?: () => void }> = ({ message, onClose }) => (
  <Toast toast={{ type: 'success', message }} onClose={onClose} />
);

export const ErrorToast: React.FC<{ message: string; onClose?: () => void }> = ({ message, onClose }) => (
  <Toast toast={{ type: 'error', message }} onClose={onClose} />
);
