import React, { forwardRef } from 'react';

export interface LuneInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const LuneInput = forwardRef<HTMLInputElement, LuneInputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 pointer-events-none text-slate-400">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          ref={ref}
          className={`w-full text-xs text-slate-100 placeholder-slate-500 bg-[#0e1017]/80 border rounded-xl py-2.5 transition-all duration-200 focus:outline-none ${
            leftIcon ? 'pl-9' : 'pl-3.5'
          } ${
            rightIcon ? 'pr-9' : 'pr-3.5'
          } ${
            error
              ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
              : 'border-white/10 hover:border-white/20 focus:border-white/40 focus:ring-1 focus:ring-white/20'
          } ${className}`}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3.5 text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-red-400 font-medium">{error}</p>
      )}

      {!error && helperText && (
        <p className="text-[11px] text-slate-400">{helperText}</p>
      )}
    </div>
  );
});

LuneInput.displayName = 'LuneInput';
