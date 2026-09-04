import React from 'react';

export interface LuneButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'chrome' | 'obsidian' | 'danger' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const LuneButton: React.FC<LuneButtonProps> = ({
  children,
  variant = 'chrome',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  let styleClasses = 'relative inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 active:scale-[0.98] select-none cursor-pointer disabled:opacity-45 disabled:pointer-events-none ';

  // Size classes
  switch (size) {
    case 'sm':
      styleClasses += 'text-xs px-3 py-1.5 gap-1.5 ';
      break;
    case 'lg':
      styleClasses += 'text-sm px-6 py-3 gap-2.5 rounded-2xl ';
      break;
    case 'icon':
      styleClasses += 'p-2 rounded-xl aspect-square ';
      break;
    case 'md':
    default:
      styleClasses += 'text-xs px-4 py-2.5 gap-2 ';
      break;
  }

  // Variant classes
  switch (variant) {
    case 'chrome':
      styleClasses += 'bg-gradient-to-b from-[#f8fafc] via-[#e2e8f0] to-[#cbd5e1] text-black font-semibold shadow-[0_2px_14px_rgba(255,255,255,0.15)] hover:shadow-[0_4px_20px_rgba(255,255,255,0.25)] border border-white/60 hover:brightness-105 ';
      break;
    case 'obsidian':
      styleClasses += 'bg-[#12141c] text-white hover:bg-[#1a1c26] border border-white/15 shadow-md shadow-black/60 hover:border-white/25 ';
      break;
    case 'danger':
      styleClasses += 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 hover:border-red-500/50 shadow-sm ';
      break;
    case 'glass':
      styleClasses += 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 hover:text-white border border-white/10 backdrop-blur-md ';
      break;
    case 'ghost':
    default:
      styleClasses += 'bg-transparent hover:bg-white/[0.06] text-slate-400 hover:text-white ';
      break;
  }

  return (
    <button className={`${styleClasses} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};
