import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  MessageSquare,
  FolderSync,
  ShieldCheck,
  ChevronUp,
  Zap
} from 'lucide-react';

interface ControlBarProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  preferredFps: 30 | 60;
  unreadChatCount: number;
  activeFileTransfersCount: number;
  isChatOpen: boolean;
  isFileTransferOpen: boolean;
  isInRoom: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onSetFps: (fps: 30 | 60) => void;
  onToggleChat: () => void;
  onToggleFileTransfer: () => void;
  onOpenSecurity: () => void;
  onLeaveRoom: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  isMuted,
  isVideoOff,
  isScreenSharing,
  preferredFps,
  unreadChatCount,
  activeFileTransfersCount,
  isChatOpen,
  isFileTransferOpen,
  isInRoom,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onSetFps,
  onToggleChat,
  onToggleFileTransfer,
  onOpenSecurity,
  onLeaveRoom,
}) => {
  const [showFpsMenu, setShowFpsMenu] = useState(false);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[95vw]">
      <div className="h-18 sm:h-20 px-3 sm:px-6 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl flex items-center justify-center gap-2 sm:gap-4 shadow-2xl shadow-black/60">
        {/* Mic toggle */}
        <button
          onClick={onToggleMute}
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl transition active:scale-95 flex items-center justify-center border ${
            isMuted
              ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white'
          }`}
          title={isMuted ? 'Ativar microfone' : 'Desativar microfone'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Video toggle */}
        <button
          onClick={onToggleVideo}
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl transition active:scale-95 flex items-center justify-center border ${
            isVideoOff
              ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white'
          }`}
          title={isVideoOff ? 'Ligar câmera' : 'Desligar câmera'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen Share with FPS Picker */}
        <div className="relative">
          <div className="flex items-center rounded-2xl overflow-hidden border border-white/10">
            <button
              onClick={onToggleScreenShare}
              className={`h-11 sm:h-12 px-3 sm:px-4 transition active:scale-95 flex items-center gap-2 ${
                isScreenSharing
                  ? 'bg-indigo-500 border-indigo-400 text-white font-semibold shadow-lg shadow-indigo-500/40'
                  : 'bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white'
              }`}
              title={isScreenSharing ? 'Parar transmissão de tela' : 'Compartilhar tela'}
            >
              <Monitor className="w-5 h-5" />
              <span className="hidden md:inline text-xs font-semibold">
                {isScreenSharing ? 'Transmitindo' : 'Compartilhar Tela'}
              </span>
            </button>
            <button
              onClick={() => setShowFpsMenu(!showFpsMenu)}
              className={`px-2 h-11 sm:h-12 border-l border-white/10 transition ${
                isScreenSharing
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
              title="Escolher taxa de quadros (30 FPS ou 60 FPS)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* FPS selector popup */}
          {showFpsMenu && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-48 rounded-2xl bg-[#0d0e16]/95 border border-white/15 p-2 shadow-2xl backdrop-blur-2xl text-slate-200 text-xs space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-indigo-400" />
                Taxa de Quadros
              </div>
              <button
                onClick={() => {
                  onSetFps(30);
                  setShowFpsMenu(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition ${
                  preferredFps === 30
                    ? 'bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30'
                    : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>30 FPS</span>
                <span className="text-[10px] text-slate-400">Padrão</span>
              </button>
              <button
                onClick={() => {
                  onSetFps(60);
                  setShowFpsMenu(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition ${
                  preferredFps === 60
                    ? 'bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30'
                    : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span>60 FPS Nativo</span>
                <span className="text-[10px] text-indigo-400 font-medium">Ultra Suave</span>
              </button>
            </div>
          )}
        </div>

        {/* Chat toggle */}
        <button
          onClick={onToggleChat}
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl transition active:scale-95 flex items-center justify-center border relative ${
            isChatOpen
              ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white'
          }`}
          title="Abrir Chat Criptografado"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500 animate-pulse" />
          )}
        </button>

        {/* File Transfer toggle */}
        <button
          onClick={onToggleFileTransfer}
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl transition active:scale-95 flex items-center justify-center border relative ${
            isFileTransferOpen
              ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white'
          }`}
          title="Compartilhar Arquivos P2P"
        >
          <FolderSync className="w-5 h-5" />
          {activeFileTransfersCount > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" />
          )}
        </button>

        {/* Security Badge Shortcut */}
        <button
          onClick={onOpenSecurity}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-emerald-400 border border-white/10 transition active:scale-95 hidden sm:flex items-center justify-center"
          title="Verificação de Criptografia E2EE de Ponta a Ponta"
        >
          <ShieldCheck className="w-5 h-5" />
        </button>

        {/* End / Leave call button matching Frosted Glass theme */}
        {isInRoom && (
          <button
            onClick={onLeaveRoom}
            className="px-4 sm:px-6 h-11 sm:h-12 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 font-bold hover:bg-red-500/30 flex items-center gap-2.5 shadow-lg shadow-red-500/20 active:scale-95 transition-all text-xs sm:text-sm tracking-wider uppercase"
            title="Encerrar Chamada"
          >
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <span>ENCERRAR</span>
          </button>
        )}
      </div>
    </div>
  );
};
