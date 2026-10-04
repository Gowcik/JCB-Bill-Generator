import React from 'react';
import type { PaymentStatus } from '../../types';
import { getStatusBadgeConfig } from '../../utils/formatters';
import { useI18n } from '../../i18n';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const { getStatusLabel } = useI18n();
  const config = getStatusBadgeConfig(status);

  const getIcon = () => {
    switch (status) {
      case 'PAID':
      case 'Paid':
        return <CheckCircle2 className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />;
      case 'PARTIALLY_PAID':
      case 'Partially Paid':
        return <Clock className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />;
      case 'UNPAID':
      case 'Unpaid':
        return <AlertCircle className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />;
    }
  };

  const sizeClasses = size === 'sm' 
    ? 'text-xs px-2 py-0.5 font-medium' 
    : 'text-xs px-2.5 py-1 font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
    >
      {getIcon()}
      <span>{getStatusLabel(status)}</span>
    </span>
  );
};
