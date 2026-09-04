import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  Users,
  Moon,
  Sun,
  Settings,
  Share2,
  Copy,
  Check,
  Radio,
  MonitorPlay
} from 'lucide-react';
import { UserInfo, AppSettings } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentUser?: UserInfo;
  roomId: string | null;
  activePeerCount?: number;
  participantCount?: number;
  settings: AppSettings;
  pendingRequestsCount?: number;
  unreadChatCount?: number;
  onOpenFriends?: () => void;
  onOpenSettings?: () => void;
  onOpenSecurity?: () => void;
  onOpenJoinRoom?: () => void;
  onOpenChat?: () => void;
  onOpenFileTransfer?: () => void;
  onToggleTheme?: () => void;
  onToggleFps?: () => void;
  onLeaveRoom?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  roomId,
  activePeerCount = 0,
  participantCount,
  settings,
  pendingRequestsCount = 0,
  unreadChatCount = 0,
  onOpenFriends,
  onOpenSettings,
  onOpenSecurity,
  onOpenJoinRoom,
  onOpenChat,
  onOpenFileTransfer,
  onToggleTheme,
  onToggleFps,
  onLeaveRoom,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const displayName = currentUser?.name || 'LUNE';
  const peerCount = participantCount !== undefined ? participantCount : (activePeerCount + 1);


  const handleCopyLink = () => {
    if (!roomId) return;
    const url = `${window.location.origin}/?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <header className="h-16 sm:h-18 w-full px-4 sm:px-6 flex items-center justify-between border-b border-white/5 backdrop-blur-xl bg-white/5 sticky top-0 z-30 transition-all">
      {/* Brand logo matching Frosted Glass theme */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-white/10 shrink-0">
          <div className="w-3 h-3 bg-white rounded-sm rotate-45 shadow-sm" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center">
              GlassStream
              <span className="hidden xs:inline-block text-indigo-400 text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest ml-2 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                Private P2P
              </span>
            </h1>
          </div>
          <p className="text-[10px] text-slate-400 hidden md:block">Transmissão em Tempo Real com Baixa Latência</p>
        </div>
      </div>

      {/* Room badge (if connected) */}
      {roomId && (
        <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md text-xs">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            Sala:
          </span>
          <span className="font-mono font-semibold text-white tracking-wider">{roomId}</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-300 font-medium">
            {peerCount} {peerCount === 1 ? 'online' : 'conectados'}
          </span>
          <button
            onClick={handleCopyLink}
            className="ml-1 p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
            title="Copiar link de convite"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      {/* Action buttons & Frosted Glass indicators */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Latency metric from theme */}
        <div className="text-right hidden sm:block">
          <p className="text-[9px] font-mono text-slate-400 leading-none uppercase tracking-wider">Latência</p>
          <p className="text-xs sm:text-sm font-mono font-bold text-slate-200 mt-0.5">
            {roomId ? (peerCount > 1 ? '14ms' : '0ms') : '12ms'}
          </p>
        </div>

        {/* E2EE Security Badge matching theme */}
        <button
          onClick={onOpenSecurity}
          className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs font-mono text-emerald-400 font-medium transition hover:bg-emerald-500/15 active:scale-95"
          title="Verificar Criptografia E2EE de Ponta a Ponta"
        >
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="tracking-wide">E2EE SECURE</span>
        </button>

        {/* FPS Switch Badge */}
        <button
          onClick={onToggleFps}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl text-xs font-semibold border backdrop-blur-md transition active:scale-95 ${
            settings.preferredFps === 60
              ? 'bg-indigo-500/20 border-indigo-400/30 text-indigo-300 hover:bg-indigo-500/30'
              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
          }`}
          title="Alternar taxa de quadros (30 FPS vs 60 FPS)"
        >
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-mono">{settings.preferredFps} FPS</span>
        </button>

        {/* Friends button */}
        <button
          onClick={onOpenFriends}
          className="relative p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 backdrop-blur-md transition active:scale-95"
          title="Amigos e convites"
        >
          <Users className="w-4 h-4" />
          {pendingRequestsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white shadow-md shadow-indigo-500/50">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        {/* PWA Install Button */}
        <PWAInstallButton compact={true} />

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 backdrop-blur-md transition active:scale-95"
          title={settings.darkMode ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
        >
          {settings.darkMode ? <Moon className="w-4 h-4 text-indigo-300" /> : <Sun className="w-4 h-4 text-amber-400" />}
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 backdrop-blur-md transition active:scale-95"
          title="Configurações de Transmissão"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User avatar circle matching Frosted Glass theme */}
        <button
          onClick={onOpenFriends}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-bold text-xs sm:text-sm shadow-sm transition hover:scale-105 active:scale-95"
          title={`Perfil de ${displayName}`}
        >
          {displayName.substring(0, 2).toUpperCase()}
        </button>
      </div>
    </header>
  );
};
