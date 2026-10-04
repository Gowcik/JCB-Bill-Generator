import React from 'react';
import { JCBMachineIcon } from './JCBMachineIcon';

interface JCBLoaderProps {
  text?: string;
  subtext?: string;
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
  mode?: 'inline' | 'card' | 'fullscreen';
  className?: string;
}

/**
 * Reusable JCB Machine Loading Indicator.
 * Displays an animated excavator with gentle bounce and bucket movement
 * alongside a professional action-state label (e.g. Processing..., Generating Bill...).
 */
export const JCBLoader: React.FC<JCBLoaderProps> = ({
  text = 'Processing...',
  subtext,
  size = 'md',
  inline = false,
  mode = 'inline',
  className = '',
}) => {
  const isInline = inline || mode === 'inline';
  const iconSize = size === 'sm' ? 'w-5 h-4' : size === 'lg' ? 'w-14 h-10' : 'w-8 h-6';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base font-extrabold' : 'text-sm font-bold';

  if (isInline) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <JCBMachineIcon className={iconSize} animate />
        <span className={textSize}>{text}</span>
      </span>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-6 text-center space-y-2.5 select-none ${className}`}>
      <div className="relative flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-xs">
        <JCBMachineIcon className={iconSize} animate />
      </div>
      <div className="space-y-0.5">
        <p className={`tracking-tight text-slate-800 ${textSize}`}>
          {text}
        </p>
        {subtext && (
          <p className="text-xs text-slate-500 font-medium">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
};
