import React from 'react';

interface JCBMachineIconProps {
  className?: string;
  size?: number | string;
  width?: number | string;
  height?: number | string;
  animate?: boolean;
}

/**
 * Professional, clean SVG illustration of a modern JCB Earthmoving / Backhoe Loader machine.
 * Designed with industrial JCB amber (#F59E0B / #D97706), dark slate cab, and rugged tires.
 */
export const JCBMachineIcon: React.FC<JCBMachineIconProps> = ({
  className = 'w-6 h-6',
  size,
  width,
  height,
  animate = false,
}) => {
  const widthAttr = width ?? size ?? undefined;
  const heightAttr = height ?? size ?? undefined;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 70"
      fill="none"
      width={widthAttr}
      height={heightAttr}
      className={`inline-block shrink-0 ${animate ? 'animate-jcb-drive' : ''} ${className}`}
      aria-label="JCB Earthmoving Machine"
    >
      {/* Ground shadow */}
      <ellipse cx="50" cy="65" rx="38" ry="3.5" fill="#0F172A" opacity="0.18" />

      {/* Rear Excavator Boom & Dipper Arm */}
      <g className={animate ? 'animate-jcb-bucket' : ''} style={{ transformOrigin: '22px 42px' }}>
        {/* Main Boom */}
        <path
          d="M22 42 L12 28 L6 16"
          stroke="#D97706"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Hydraulic Cylinder */}
        <path d="M19 44 L11 31" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
        {/* Dipper Stick */}
        <path
          d="M6 16 L2 28"
          stroke="#F59E0B"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Rear Digging Bucket */}
        <path
          d="M2 28 C-1 30 -2 36 2 38 L6 35 L4 28 Z"
          fill="#1E293B"
          stroke="#0F172A"
          strokeWidth="1.2"
        />
        {/* Teeth */}
        <path d="M-1 34 L1 36 M-0.5 31 L1.5 33" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Main Machine Body Chassis (JCB Yellow/Amber) */}
      <path
        d="M22 46 L22 36 L30 36 L36 24 L56 24 L60 36 L72 36 L76 44 L78 52 L22 52 Z"
        fill="#F59E0B"
        stroke="#D97706"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Engine Hood / Grille Accent */}
      <path d="M60 36 L72 36 L75 42 L58 42 Z" fill="#D97706" />
      <line x1="62" y1="39" x2="70" y2="39" stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="63" y1="41" x2="69" y2="41" stroke="#78350F" strokeWidth="1.2" strokeLinecap="round" />

      {/* Operator Cabin Structure */}
      <path
        d="M33 36 L38 25 L54 25 L58 36 Z"
        fill="#0F172A"
        stroke="#1E293B"
        strokeWidth="1.5"
      />
      {/* Cabin Glass / Windows (Tinted Cyan/Slate) */}
      <path
        d="M39 27 L45 27 L45 35 L35 35 Z"
        fill="#38BDF8"
        opacity="0.75"
      />
      <path
        d="M47 27 L53 27 L56 35 L47 35 Z"
        fill="#0284C7"
        opacity="0.75"
      />
      {/* ROPS Roll Cage Pillars */}
      <line x1="46" y1="25" x2="46" y2="36" stroke="#0F172A" strokeWidth="1.8" />

      {/* Exhaust Pipe */}
      <path d="M58 24 L58 17 L60 16" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" />

      {/* Front Loader Arms */}
      <path
        d="M56 42 L74 38 L86 46"
        stroke="#D97706"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Front Hydraulic Ram */}
      <path d="M62 44 L75 40" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />

      {/* Front Loader Bucket */}
      <path
        d="M86 42 L94 42 C97 42 98 48 95 54 L84 54 L82 46 Z"
        fill="#1E293B"
        stroke="#0F172A"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Front Bucket Teeth */}
      <polygon points="94,54 96,56 94,57" fill="#F59E0B" />
      <polygon points="91,54 93,56 91,57" fill="#F59E0B" />
      <polygon points="88,54 90,56 88,57" fill="#F59E0B" />

      {/* Stabilizer Leg (folded) */}
      <path d="M25 48 L22 55" stroke="#334155" strokeWidth="3" strokeLinecap="round" />

      {/* Heavy Rear Wheel */}
      <g>
        <circle cx="32" cy="53" r="12" fill="#0F172A" stroke="#334155" strokeWidth="2" />
        <circle cx="32" cy="53" r="7" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5" />
        <circle cx="32" cy="53" r="3" fill="#1E293B" />
        {/* Tire Treads */}
        <line x1="32" y1="41" x2="32" y2="43" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="32" y1="63" x2="32" y2="65" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="20" y1="53" x2="22" y2="53" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="42" y1="53" x2="44" y2="53" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Front Wheel (Smaller) */}
      <g>
        <circle cx="70" cy="55" r="9.5" fill="#0F172A" stroke="#334155" strokeWidth="1.8" />
        <circle cx="70" cy="55" r="5" fill="#F59E0B" stroke="#D97706" strokeWidth="1.2" />
        <circle cx="70" cy="55" r="2.2" fill="#1E293B" />
        {/* Tire Treads */}
        <line x1="70" y1="45.5" x2="70" y2="47" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
        <line x1="70" y1="63" x2="70" y2="64.5" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
};

/**
 * Returns a high-resolution, self-contained SVG string of the JCB Machine
 * suitable for embedding in Canvas 2D or print HTML.
 */
export const getJCBMachineSvgString = (): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70" width="100" height="70">
    <ellipse cx="50" cy="65" rx="38" ry="3.5" fill="#0F172A" opacity="0.18" />
    <path d="M22 42 L12 28 L6 16" stroke="#D97706" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M19 44 L11 31" stroke="#334155" stroke-width="2.5" stroke-linecap="round" />
    <path d="M6 16 L2 28" stroke="#F59E0B" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2 28 C-1 30 -2 36 2 38 L6 35 L4 28 Z" fill="#1E293B" stroke="#0F172A" stroke-width="1.2" />
    <path d="M-1 34 L1 36 M-0.5 31 L1.5 33" stroke="#F59E0B" stroke-width="1.5" stroke-linecap="round" />
    <path d="M22 46 L22 36 L30 36 L36 24 L56 24 L60 36 L72 36 L76 44 L78 52 L22 52 Z" fill="#F59E0B" stroke="#D97706" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M60 36 L72 36 L75 42 L58 42 Z" fill="#D97706" />
    <line x1="62" y1="39" x2="70" y2="39" stroke="#78350F" stroke-width="1.2" stroke-linecap="round" />
    <line x1="63" y1="41" x2="69" y2="41" stroke="#78350F" stroke-width="1.2" stroke-linecap="round" />
    <path d="M33 36 L38 25 L54 25 L58 36 Z" fill="#0F172A" stroke="#1E293B" stroke-width="1.5" />
    <path d="M39 27 L45 27 L45 35 L35 35 Z" fill="#38BDF8" opacity="0.8" />
    <path d="M47 27 L53 27 L56 35 L47 35 Z" fill="#0284C7" opacity="0.8" />
    <line x1="46" y1="25" x2="46" y2="36" stroke="#0F172A" stroke-width="1.8" />
    <path d="M58 24 L58 17 L60 16" stroke="#475569" stroke-width="2.2" stroke-linecap="round" />
    <path d="M56 42 L74 38 L86 46" stroke="#D97706" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M62 44 L75 40" stroke="#334155" stroke-width="2.5" stroke-linecap="round" />
    <path d="M86 42 L94 42 C97 42 98 48 95 54 L84 54 L82 46 Z" fill="#1E293B" stroke="#0F172A" stroke-width="1.5" stroke-linejoin="round" />
    <polygon points="94,54 96,56 94,57" fill="#F59E0B" />
    <polygon points="91,54 93,56 91,57" fill="#F59E0B" />
    <polygon points="88,54 90,56 88,57" fill="#F59E0B" />
    <circle cx="32" cy="53" r="12" fill="#0F172A" stroke="#334155" stroke-width="2" />
    <circle cx="32" cy="53" r="7" fill="#F59E0B" stroke="#D97706" stroke-width="1.5" />
    <circle cx="32" cy="53" r="3" fill="#1E293B" />
    <circle cx="70" cy="55" r="9.5" fill="#0F172A" stroke="#334155" stroke-width="1.8" />
    <circle cx="70" cy="55" r="5" fill="#F59E0B" stroke="#D97706" stroke-width="1.2" />
    <circle cx="70" cy="55" r="2.2" fill="#1E293B" />
  </svg>`;
};
