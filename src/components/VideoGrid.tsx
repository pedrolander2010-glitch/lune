import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  Monitor,
  Zap,
  Activity,
  Pin,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { UserInfo, StreamConfig } from '../types';
import { PeerItem } from '../utils/webrtcManager';

interface VideoTileProps {
  stream: MediaStream | null;
  user: UserInfo;
  isLocal?: boolean;
  isScreen?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  rttMs?: number;
  fps?: number;
  isPinned?: boolean;
  onPin?: () => void;
  preferredFps: number;
}

const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  user,
  isLocal = false,
  isScreen = false,
  isMuted = false,
  isVideoOff = false,
  rttMs,
  fps,
  isPinned = false,
  onPin,
  preferredFps,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const hasVideo = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled && !isVideoOff;

  return (
    <div
      ref={containerRef}
      className={`group relative rounded-[28px] sm:rounded-[32px] overflow-hidden bg-black/40 border transition-all duration-300 backdrop-blur-sm flex flex-col justify-between shadow-2xl ${
        isPinned
          ? 'col-span-full row-span-2 border-indigo-500/60 ring-2 ring-indigo-500/30'
          : isScreen
          ? 'border-indigo-400/40 ring-1 ring-indigo-400/20'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Video Element or Avatar Fallback */}
      <div className="absolute inset-0 flex items-center justify-center bg-[#07070a]">
        {hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className={`w-full h-full object-contain ${
              isLocal && !isScreen ? '-scale-x-100' : ''
            }`}
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center text-white text-3xl sm:text-4xl font-bold shadow-2xl ring-4 ring-white/10 relative"
              style={{ backgroundColor: user?.avatarColor || '#4f46e5' }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              {!isMuted && (
                <span className="absolute -inset-1.5 rounded-3xl border-2 border-indigo-400 animate-pulse" />
              )}
            </div>
            <div className="text-center">
              <span className="text-sm font-semibold text-white block">{user?.name || 'Participante'}</span>
              <span className="text-xs text-slate-400 font-mono">{user?.tag || '@user'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Top Bar Indicators matching Frosted Glass theme */}
      <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none">
        <div className="flex items-center gap-2">
          {/* Main User/Stream Badge */}
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 text-xs sm:text-sm font-semibold text-white pointer-events-auto shadow-md">
            <div
              className={`w-2.5 h-2.5 rounded-sm ${
                isScreen ? 'bg-red-500 animate-pulse' : 'bg-indigo-400'
              }`}
            />
            <span>
              {isScreen ? `Tela de ${user?.name || 'Usuário'}` : (user?.name || 'Usuário')} {isLocal && !isScreen && '(Você)'}
            </span>
            <span className="text-slate-400 font-normal text-xs hidden sm:inline">
              • 1080p @ {fps || preferredFps} FPS
            </span>
          </div>

          {/* E2EE badge on stream */}
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            E2EE
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
          {onPin && (
            <button
              onClick={onPin}
              className={`p-2 rounded-xl border backdrop-blur-md transition ${
                isPinned
                  ? 'bg-indigo-500 text-white border-indigo-400 shadow-md shadow-indigo-500/30'
                  : 'bg-black/60 text-slate-200 border-white/15 hover:bg-white/10'
              }`}
              title={isPinned ? 'Desafixar vídeo' : 'Fixar em destaque'}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-black/60 text-slate-200 border border-white/15 hover:bg-white/10 backdrop-blur-md transition"
            title="Tela cheia"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Bottom Bar: Status Badges */}
      <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent">
        <div className="flex items-center gap-2">
          {/* Audio State */}
          <span
            className={`p-2 rounded-xl backdrop-blur-md border ${
              isMuted
                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
            }`}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </span>

          {/* Video State */}
          <span
            className={`p-2 rounded-xl backdrop-blur-md border ${
              !hasVideo
                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                : 'bg-white/5 border-white/10 text-slate-200'
            }`}
          >
            {!hasVideo ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
          </span>
        </div>

        {/* Latency & Quality metrics */}
        <div className="flex items-center gap-2">
          {rttMs !== undefined && rttMs > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-black/60 border border-white/10 text-[11px] font-mono text-emerald-400 backdrop-blur-md">
              <Activity className="w-3 h-3" />
              {rttMs}ms
            </span>
          )}
          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 text-[10px] font-mono font-medium">
            MESH
          </span>
        </div>
      </div>
    </div>
  );
};

interface VideoGridProps {
  currentUser: UserInfo;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  peers: PeerItem[];
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  preferredFps: 30 | 60;
  isInRoom: boolean;
  onJoinOrCreateRoom: () => void;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  currentUser,
  localStream,
  screenStream,
  peers,
  isMuted,
  isVideoOff,
  isScreenSharing,
  preferredFps,
  isInRoom,
  onJoinOrCreateRoom,
}) => {
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // If not in a room, show the sleek Frosted Glass lobby setup
  if (!isInRoom) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-xl rounded-[32px] bg-white/5 border border-white/10 p-6 sm:p-8 shadow-2xl shadow-indigo-950/40 backdrop-blur-2xl relative overflow-hidden text-center">
          {/* Frosted Glow backdrop */}
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-600/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Monitor className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Transmissão P2P com Baixa Latência
              </h2>
              <p className="text-sm text-slate-300 mt-2 max-w-md mx-auto leading-relaxed">
                Chamadas de vídeo e compartilhamento de tela nativo em 30 ou 60 FPS com criptografia total ponta a ponta para você e seus amigos.
              </p>
            </div>

            {/* Local Preview Tile */}
            <div className="w-full h-56 sm:h-64 rounded-[24px] overflow-hidden bg-black/40 border border-white/10 relative shadow-inner">
              {localStream && !isVideoOff ? (
                <video
                  autoPlay
                  playsInline
                  muted
                  ref={(v) => {
                    if (v) v.srcObject = localStream;
                  }}
                  className="w-full h-full object-cover -scale-x-100"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 bg-[#08080c]">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                    style={{ backgroundColor: currentUser?.avatarColor || '#4f46e5' }}
                  >
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'V'}
                  </div>
                  <span className="text-xs">Câmera desativada no momento</span>
                </div>
              )}

              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-black/60 border border-white/10 text-xs font-medium text-white backdrop-blur-md flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {currentUser?.name || 'Você'}
                </span>
                <span className="px-3 py-1 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-xs font-semibold text-indigo-300 backdrop-blur-md">
                  {preferredFps} FPS
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={onJoinOrCreateRoom}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-500/30 active:scale-95 flex items-center justify-center gap-2 border border-white/10"
              >
                <Sparkles className="w-4 h-4" />
                Criar / Entrar em Sala
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Count total tiles:
  // Screen stream (if active) + Local stream + Remote peers
  const items: Array<{
    id: string;
    stream: MediaStream | null;
    user: UserInfo;
    isLocal?: boolean;
    isScreen?: boolean;
    isMuted?: boolean;
    isVideoOff?: boolean;
    rttMs?: number;
    fps?: number;
  }> = [];

  // 1. Screen sharing stream
  if (screenStream && isScreenSharing) {
    items.push({
      id: 'local-screen',
      stream: screenStream,
      user: currentUser,
      isLocal: true,
      isScreen: true,
      isMuted,
      isVideoOff: false,
      fps: preferredFps,
    });
  }

  // 2. Local camera stream
  items.push({
    id: 'local-cam',
    stream: localStream,
    user: currentUser,
    isLocal: true,
    isScreen: false,
    isMuted,
    isVideoOff,
    fps: preferredFps,
  });

  // 3. Remote peer streams
  peers.forEach((peer) => {
    items.push({
      id: peer.peerId,
      stream: peer.stream || null,
      user: peer.user,
      isLocal: false,
      isScreen: false,
      isMuted: false,
      isVideoOff: false,
      rttMs: peer.metrics.rttMs,
      fps: peer.metrics.currentFps,
    });
  });

  // Grid columns based on item count
  const getGridClass = () => {
    if (pinnedId) return 'grid-cols-1 md:grid-cols-3';
    if (items.length <= 1) return 'grid-cols-1 max-w-4xl mx-auto';
    if (items.length === 2) return 'grid-cols-1 md:grid-cols-2';
    if (items.length <= 4) return 'grid-cols-1 sm:grid-cols-2';
    return 'grid-cols-2 md:grid-cols-3';
  };

  return (
    <div className="flex-1 p-3 sm:p-5 overflow-y-auto">
      <div className={`grid gap-3 sm:gap-4 h-full min-h-[420px] ${getGridClass()}`}>
        {items.map((item) => (
          <VideoTile
            key={item.id}
            stream={item.stream}
            user={item.user}
            isLocal={item.isLocal}
            isScreen={item.isScreen}
            isMuted={item.isMuted}
            isVideoOff={item.isVideoOff}
            rttMs={item.rttMs}
            fps={item.fps}
            isPinned={pinnedId === item.id}
            onPin={() => setPinnedId(pinnedId === item.id ? null : item.id)}
            preferredFps={preferredFps}
          />
        ))}
      </div>
    </div>
  );
};
