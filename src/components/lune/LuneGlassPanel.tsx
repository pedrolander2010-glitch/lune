import React from 'react';

interface LuneGlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'subtle' | 'standard' | 'elevated' | 'obsidian';
  className?: string;
  glow?: boolean;
}

export const LuneGlassPanel: React.FC<LuneGlassPanelProps> = ({
  children,
  variant = 'standard',
  className = '',
  glow = false,
  ...props
}) => {
  let baseStyles = 'rounded-2xl transition-all duration-200 ';

  switch (variant) {
    case 'subtle':
      baseStyles += 'bg-[#0e1017]/60 backdrop-blur-xl border border-white/[0.06] shadow-md ';
      break;
    case 'elevated':
      baseStyles += 'bg-gradient-to-b from-[#181a24]/85 to-[#0b0c12]/95 backdrop-blur-2xl border border-white/[0.14] shadow-2xl shadow-black/80 ';
      break;
    case 'obsidian':
      baseStyles += 'bg-[#08090d] border border-white/[0.07] shadow-xl ';
      break;
    case 'standard':
    default:
      baseStyles += 'bg-[#0c0d15]/80 backdrop-blur-2xl border border-white/[0.09] shadow-xl shadow-black/60 ';
      break;
  }

  if (glow) {
    baseStyles += 'ring-1 ring-white/20 shadow-[0_0_30px_rgba(255,255,255,0.06)] ';
  }

  return (
    <div className={`${baseStyles} ${className}`} {...props}>
      {children}
    </div>
  );
};
