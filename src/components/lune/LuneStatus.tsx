import React from 'react';
import { LunePresence } from '../../types';

export interface LuneStatusProps {
  presence: LunePresence;
  showLabel?: boolean;
  className?: string;
}

export const LuneStatus: React.FC<LuneStatusProps> = ({
  presence,
  showLabel = true,
  className = '',
}) => {
  const getDotStyle = () => {
    switch (presence) {
      case 'ONLINE':
        return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]';
      case 'IDLE':
        return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]';
      case 'DO_NOT_DISTURB':
        return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]';
      case 'STREAMING':
        return 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.7)] animate-pulse';
      case 'GHOST':
        return 'bg-slate-400 border border-slate-300/40';
      case 'OFFLINE':
      default:
        return 'bg-slate-600';
    }
  };

  const getLabel = () => {
    switch (presence) {
      case 'ONLINE':
        return 'Online';
      case 'IDLE':
        return 'Ausente';
      case 'DO_NOT_DISTURB':
        return 'Não Perturbar';
      case 'STREAMING':
        return 'Transmitindo';
      case 'GHOST':
        return 'Ghost (Invisível)';
      case 'OFFLINE':
      default:
        return 'Offline';
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 text-xs text-slate-300 select-none ${className}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${getDotStyle()}`} />
      {showLabel && <span className="font-medium text-[11px]">{getLabel()}</span>}
    </div>
  );
};
