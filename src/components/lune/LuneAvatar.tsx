import React from 'react';
import { LunePresence } from '../../types';
import { getAssetUrl, LUNE_LOGO_URL } from '../../utils/assets';

export interface LuneAvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  presence?: LunePresence;
  className?: string;
  showPresence?: boolean;
}

export const LuneAvatar: React.FC<LuneAvatarProps> = ({
  src,
  name = 'User',
  size = 'md',
  presence,
  className = '',
  showPresence = true,
}) => {
  let sizeClasses = 'w-9 h-9 text-xs';
  let badgeSize = 'w-2.5 h-2.5 -bottom-0.5 -right-0.5 border-2';

  switch (size) {
    case 'xs':
      sizeClasses = 'w-6 h-6 text-[10px]';
      badgeSize = 'w-2 h-2 -bottom-0.5 -right-0.5 border-[1.5px]';
      break;
    case 'sm':
      sizeClasses = 'w-8 h-8 text-xs';
      badgeSize = 'w-2.5 h-2.5 -bottom-0.5 -right-0.5 border-2';
      break;
    case 'lg':
      sizeClasses = 'w-12 h-12 text-sm';
      badgeSize = 'w-3.5 h-3.5 bottom-0 right-0 border-2';
      break;
    case 'xl':
      sizeClasses = 'w-16 h-16 text-lg';
      badgeSize = 'w-4 h-4 bottom-0.5 right-0.5 border-2';
      break;
  }

  const getPresenceColor = (status?: LunePresence) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
      case 'IDLE':
        return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]';
      case 'DO_NOT_DISTURB':
        return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]';
      case 'STREAMING':
        return 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)] animate-pulse';
      case 'GHOST':
      case 'OFFLINE':
      default:
        return 'bg-slate-500';
    }
  };

  const initial = name ? name.charAt(0).toUpperCase() : 'L';

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      <div
        className={`${sizeClasses} rounded-2xl overflow-hidden bg-gradient-to-br from-[#202430] to-[#0c0d15] border border-white/15 flex items-center justify-center font-bold text-slate-200 shadow-md`}
      >
        {src ? (
          <img
            src={getAssetUrl(src)}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback if image fails
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-[#12141d] p-1">
            <img src={LUNE_LOGO_URL} alt="LUNE" className="w-4/5 h-4/5 object-contain filter drop-shadow opacity-90" />
          </div>
        )}
      </div>

      {showPresence && presence && (
        <span
          title={`Status: ${presence}`}
          className={`absolute rounded-full border-[#08090d] ${badgeSize} ${getPresenceColor(presence)}`}
        />
      )}
    </div>
  );
};
