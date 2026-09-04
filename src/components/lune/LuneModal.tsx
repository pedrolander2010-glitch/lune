import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface LuneModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  icon?: React.ReactNode;
}

export const LuneModal: React.FC<LuneModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
  icon,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let widthClass = 'max-w-md';
  switch (maxWidth) {
    case 'sm':
      widthClass = 'max-w-sm';
      break;
    case 'lg':
      widthClass = 'max-w-lg';
      break;
    case 'xl':
      widthClass = 'max-w-xl';
      break;
    case '2xl':
      widthClass = 'max-w-2xl';
      break;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className={`relative w-full ${widthClass} rounded-[28px] bg-gradient-to-b from-[#141622]/95 via-[#0c0d15]/95 to-[#08090e]/98 border border-white/15 p-6 shadow-2xl shadow-black/90 backdrop-blur-2xl text-slate-100 max-h-[90vh] flex flex-col z-10`}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition active:scale-95"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {(title || icon) && (
          <div className="flex items-center gap-3.5 mb-5 shrink-0">
            {icon && (
              <div className="w-10 h-10 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center text-slate-200 shadow-inner shrink-0">
                {icon}
              </div>
            )}
            <div>
              {title && <h3 className="text-base font-semibold text-white tracking-wide">{title}</h3>}
              {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
