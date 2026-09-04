import React from 'react';

export interface LuneBadgeProps {
  children: React.ReactNode;
  variant?: 'chrome' | 'obsidian' | 'accent' | 'danger' | 'success';
  className?: string;
}

export const LuneBadge: React.FC<LuneBadgeProps> = ({
  children,
  variant = 'obsidian',
  className = '',
}) => {
  let styleClasses = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider select-none ';

  switch (variant) {
    case 'chrome':
      styleClasses += 'bg-white/90 text-black border border-white/60 shadow-sm ';
      break;
    case 'accent':
      styleClasses += 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 ';
      break;
    case 'danger':
      styleClasses += 'bg-rose-500/20 text-rose-300 border border-rose-500/30 ';
      break;
    case 'success':
      styleClasses += 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 ';
      break;
    case 'obsidian':
    default:
      styleClasses += 'bg-white/[0.07] text-slate-300 border border-white/10 ';
      break;
  }

  return (
    <span className={`${styleClasses} ${className}`}>
      {children}
    </span>
  );
};
