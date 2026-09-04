import React, { useEffect } from 'react';
import { PhoneCall, PhoneOff, MonitorPlay } from 'lucide-react';
import { IncomingCall } from '../types';
import { startRingtone, stopRingtone } from '../utils/audioAlerts';

interface IncomingCallToastProps {
  call: IncomingCall | null;
  onAccept: (call: IncomingCall) => void;
  onDecline: () => void;
  soundEnabled: boolean;
}

export const IncomingCallToast: React.FC<IncomingCallToastProps> = ({
  call,
  onAccept,
  onDecline,
  soundEnabled,
}) => {
  useEffect(() => {
    if (call && soundEnabled) {
      startRingtone();
    } else {
      stopRingtone();
    }
    return () => {
      stopRingtone();
    };
  }, [call, soundEnabled]);

  if (!call) return null;

  const handleAccept = () => {
    stopRingtone();
    onAccept(call);
  };

  const handleDecline = () => {
    stopRingtone();
    onDecline();
  };

  return (
    <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-4 duration-300">
      <div className="w-80 rounded-[28px] bg-[#0c0d15]/95 border border-white/15 p-5 shadow-2xl backdrop-blur-2xl text-slate-100 ring-2 ring-indigo-500/20">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg relative"
            style={{ backgroundColor: call?.fromUser?.avatarColor || '#6366f1' }}
          >
            {call?.fromUser?.name ? call.fromUser.name.charAt(0).toUpperCase() : 'U'}
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-500"></span>
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
              <MonitorPlay className="w-3.5 h-3.5" />
              <span>Chamada Recebida</span>
            </div>
            <h4 className="text-sm font-bold text-white truncate mt-0.5">
              {call?.fromUser?.name || 'Usuário LUNE'}
            </h4>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {call?.fromUser?.tag || '@amigo'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2.5">
          <button
            onClick={handleDecline}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-semibold transition active:scale-95"
          >
            <PhoneOff className="w-4 h-4" />
            Recusar
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-md shadow-emerald-900/30 active:scale-95 border border-emerald-400/30"
          >
            <PhoneCall className="w-4 h-4" />
            Atender
          </button>
        </div>
      </div>
    </div>
  );
};
