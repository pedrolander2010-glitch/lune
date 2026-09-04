import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LuneUser,
  LuneConversation,
  LunePresence,
  AppSettings,
  UserInfo,
  Friend,
  FriendRequest,
  IncomingCall,
  ChatMessage,
  SharedFile,
} from './types';
import { WebRTCManager, PeerItem } from './utils/webrtcManager';
import { encryptText, decryptText, generateSafetyFingerprint } from './utils/crypto';
import {
  playMessageSound,
  playJoinSound,
  playFileReceivedSound,
  stopRingtone,
  dispatchPushNotification,
} from './utils/audioAlerts';
import { sendFileOverDataChannel, handleIncomingFileChunk } from './utils/fileTransfer';

// Components
import { Header } from './components/Header';
import { VideoGrid } from './components/VideoGrid';
import { ControlBar } from './components/ControlBar';
import { SettingsModal } from './components/SettingsModal';
import { SecurityBadgeModal } from './components/SecurityBadgeModal';
import { IncomingCallToast } from './components/IncomingCallToast';
import { JoinRoomModal } from './components/JoinRoomModal';
import { FileTransferPanel } from './components/FileTransferPanel';

// LUNE Design System & Full-Stack Components
import { AuthModal } from './components/lune/AuthModal';
import { SecurityPinModal } from './components/lune/SecurityPinModal';
import { SessionsModal } from './components/lune/SessionsModal';
import { LuneFriendsView } from './components/lune/LuneFriendsView';
import { LuneChatView } from './components/lune/LuneChatView';
import { LuneAvatar } from './components/lune/LuneAvatar';
import { LuneButton } from './components/lune/LuneButton';
import { LUNE_LOGO_URL } from './utils/assets';

import {
  MessageSquare,
  Users,
  Video,
  Shield,
  Settings,
  LogOut,
  Sparkles,
  Search,
  Plus,
  Radio,
  Lock,
  ChevronDown,
  Monitor,
} from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  preferredFps: 60,
  preferredResolution: '1080p',
  roomEncryptionKey: 'lune_glass_key_2026',
  pushNotificationsEnabled: false,
  soundAlertsEnabled: true,
  soundVolume: 0.5,
  noiseSuppression: true,
  echoCancellation: true,
};

export default function App() {
  // LUNE Authenticated User State
  const [luneUser, setLuneUser] = useState<LuneUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSecurityPinModalOpen, setIsSecurityPinModalOpen] = useState(false);
  const [securityModalInitialTab, setSecurityModalInitialTab] = useState<'CHANGE_NAME' | 'SETUP_PIN' | 'AUDIT_LOGS'>('CHANGE_NAME');
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);

  // Navigation: 'CHATS' | 'FRIENDS' | 'STREAM'
  const [currentNav, setCurrentNav] = useState<'CHATS' | 'FRIENDS' | 'STREAM'>('CHATS');
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [inviteParamUser, setInviteParamUser] = useState<string | null>(null);

  // Conversations State
  const [conversations, setConversations] = useState<LuneConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [convSearch, setConvSearch] = useState('');

  // Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('lune_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Call & WebRTC Stream States
  const [roomId, setRoomId] = useState<string | null>(null);
  const [activePeers, setActivePeers] = useState<PeerItem[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [fingerprint, setFingerprint] = useState('00000 00000 00000 00000 00000 00000');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals & Panels
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [isFileTransferOpen, setIsFileTransferOpen] = useState(false);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [streamChatMessages, setStreamChatMessages] = useState<ChatMessage[]>([]);
  const [isStreamChatOpen, setIsStreamChatOpen] = useState(false);

  // Presence Dropdown
  const [showPresenceMenu, setShowPresenceMenu] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Check Authenticated Session & URL Parameters on Mount
  useEffect(() => {
    // Check URL parameters for invites or room joins
    try {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get('invite');
      if (invite) {
        const clean = invite.replace(/^@/, '').trim();
        setInviteParamUser(clean);
        setCurrentNav('FRIENDS');
      }
      const room = params.get('room');
      if (room) {
        setRoomId(room.trim());
        setCurrentNav('STREAM');
      }
    } catch {
      // ignore
    }

    const token = localStorage.getItem('lune_session_token');
    if (!token) {
      setAuthChecking(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setLuneUser(data.user);
        } else {
          localStorage.removeItem('lune_session_token');
        }
      })
      .catch(() => {
        // network issue
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  // 2. Fetch Conversations & Pending Friend Requests
  const fetchConversations = useCallback(async () => {
    const token = localStorage.getItem('lune_session_token');
    if (!token) return;
    try {
      const res = await fetch('/api/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.conversations) {
        setConversations(data.conversations);
        if (!selectedConversationId && data.conversations.length > 0) {
          setSelectedConversationId(data.conversations[0].id);
        }
      }
    } catch {
      // ignore
    }
  }, [selectedConversationId]);

  const fetchPendingRequests = useCallback(async () => {
    const token = localStorage.getItem('lune_session_token');
    if (!token) return;
    try {
      const res = await fetch('/api/friends', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.friends) {
        const pendingIncoming = data.friends.filter(
          (f: any) => f.status === 'PENDING' && f.isIncoming
        ).length;
        setPendingRequestsCount(pendingIncoming);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (luneUser) {
      fetchConversations();
      fetchPendingRequests();
      const interval = setInterval(() => {
        fetchConversations();
        fetchPendingRequests();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [luneUser, fetchConversations, fetchPendingRequests]);

  // 3. WebRTC Signal Sender wrapper
  const sendSignal = useCallback((toUserId: string, signalData: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && roomId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'signal',
          payload: {
            toUserId,
            roomId,
            signalData,
          },
        })
      );
    }
  }, [roomId]);

  // 4. Setup WebRTC Manager
  useEffect(() => {
    const manager = new WebRTCManager(
      sendSignal,
      (peers) => {
        setActivePeers(peers);
      },
      async (fromUser, data) => {
        if (data.type === 'chat') {
          const decrypted = await decryptText(data.ciphertext, settings.roomEncryptionKey, roomId || '');
          const newMsg: ChatMessage = {
            id: data.id,
            roomId: roomId || '',
            sender: fromUser,
            encryptedText: data.ciphertext,
            decryptedText: decrypted,
            timestamp: data.timestamp,
            isEncrypted: true,
          };
          setStreamChatMessages((prev) => [...prev, newMsg]);
          if (settings.soundAlertsEnabled) playMessageSound(settings.soundVolume);
        }
      },
      (fromUser, chunk) => {
        handleIncomingFileChunk(chunk, (updatedFile) => {
          setSharedFiles((prev) => {
            const idx = prev.findIndex((f) => f.id === updatedFile.id);
            if (idx >= 0) {
              const clone = [...prev];
              clone[idx] = updatedFile;
              return clone;
            }
            return [updatedFile, ...prev];
          });
          if (updatedFile.status === 'completed') {
            if (settings.soundAlertsEnabled) playFileReceivedSound(settings.soundVolume);
            showToast(`Arquivo "${updatedFile.name}" recebido!`);
          }
        });
      }
    );

    webrtcManagerRef.current = manager;

    manager
      .startLocalMedia({
        fps: settings.preferredFps,
        resolution: settings.preferredResolution,
        captureAudio: true,
      })
      .then((stream) => {
        setLocalStream(stream);
      })
      .catch((err) => {
        console.warn('Media devices waiting or unavailable:', err);
      });

    return () => {
      manager.closeAll();
    };
  }, [sendSignal, settings.roomEncryptionKey, roomId, settings.soundAlertsEnabled, settings.soundVolume, settings.preferredFps, settings.preferredResolution]);

  // 5. Connect WebSocket Realtime Engine
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      const token = localStorage.getItem('lune_session_token');
      if (token) {
        ws.send(JSON.stringify({ type: 'auth', payload: { token } }));
      }
      if (luneUser) {
        ws.send(JSON.stringify({
          type: 'set-identity',
          payload: {
            id: luneUser.id,
            name: luneUser.displayName,
            tag: `@${luneUser.username}`,
            avatarColor: '#d1d5db',
          },
        }));
      }
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, payload } = data;

        switch (type) {
          case 'message:new': {
            fetchConversations();
            if (settings.soundAlertsEnabled) playMessageSound(settings.soundVolume);
            break;
          }

          case 'friend:request': {
            fetchConversations();
            showToast(`@${payload.fromUser.username} enviou uma solicitação de amizade!`);
            if (settings.soundAlertsEnabled) playMessageSound(settings.soundVolume);
            break;
          }

          case 'friend:accepted': {
            fetchConversations();
            showToast(`@${payload.byUser.username} aceitou sua solicitação!`);
            break;
          }

          case 'call:incoming':
          case 'incoming-call': {
            const { fromUser, roomId: callRoomId, timestamp } = payload;
            setIncomingCall({
              fromUser: fromUser.tag ? fromUser : { id: fromUser.id, name: fromUser.username, tag: `@${fromUser.username}`, avatarColor: '#d1d5db' },
              roomId: callRoomId || `lune_${fromUser.id.slice(0, 6)}`,
              timestamp: timestamp || Date.now(),
            });
            break;
          }

          case 'joined-room-success': {
            const { roomId: joinedRoomId, participants } = payload;
            setRoomId(joinedRoomId);
            if (webrtcManagerRef.current && participants) {
              for (const peerUser of participants) {
                webrtcManagerRef.current.createPeerConnection(peerUser, true);
              }
            }
            if (settings.soundAlertsEnabled) playJoinSound(settings.soundVolume);
            showToast(`Conectado à sala ${joinedRoomId}`);
            break;
          }

          case 'user-joined': {
            const { user: newUser } = payload;
            if (webrtcManagerRef.current) {
              webrtcManagerRef.current.createPeerConnection(newUser, false);
            }
            if (settings.soundAlertsEnabled) playJoinSound(settings.soundVolume);
            showToast(`${newUser.name} entrou na chamada`);
            break;
          }

          case 'user-left': {
            const { userId, user: leftUser } = payload;
            if (webrtcManagerRef.current) {
              webrtcManagerRef.current.removePeer(userId);
            }
            showToast(`${leftUser?.name || 'Um participante'} saiu`);
            break;
          }

          case 'signal': {
            const { fromUser, signalData } = payload;
            if (webrtcManagerRef.current) {
              webrtcManagerRef.current.handleSignal(fromUser, signalData);
            }
            break;
          }
        }
      } catch (e) {
        console.error('Error handling WS:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [luneUser, fetchConversations, settings.soundAlertsEnabled, settings.soundVolume]);

  // Compute safety fingerprint
  useEffect(() => {
    generateSafetyFingerprint(settings.roomEncryptionKey, roomId || 'lobby').then(setFingerprint);
  }, [settings.roomEncryptionKey, roomId]);

  // Room Join & Call Handlers
  const handleJoinRoom = (targetRoomId: string, passKey?: string) => {
    if (passKey) {
      setSettings((prev) => ({ ...prev, roomEncryptionKey: passKey }));
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'join-room',
          payload: {
            roomId: targetRoomId,
            user: {
              id: luneUser?.id || 'guest',
              name: luneUser?.displayName || 'Convidado LUNE',
              tag: `@${luneUser?.username || 'user'}`,
              avatarColor: '#d1d5db',
            },
          },
        })
      );
    }
    setCurrentNav('STREAM');
  };

  const handleLeaveRoom = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave-room' }));
    }
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.stopScreenShare();
      setIsScreenSharing(false);
      setScreenStream(null);
    }
    setRoomId(null);
    setActivePeers([]);
    showToast('Você saiu da chamada');
  };

  const handleToggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.stopScreenShare();
      }
      setIsScreenSharing(false);
      setScreenStream(null);
    } else {
      try {
        if (!webrtcManagerRef.current) return;
        const screen = await webrtcManagerRef.current.startScreenShare(settings.preferredFps, true);
        setScreenStream(screen);
        setIsScreenSharing(true);
        screen.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
        };
      } catch (err) {
        console.warn('Screen share canceled or denied:', err);
      }
    }
  };

  const handleSetFps = (fps: 30 | 60) => {
    setSettings((prev) => ({ ...prev, preferredFps: fps }));
    showToast(`Taxa de quadros configurada para ${fps} FPS`);
    if (isScreenSharing) {
      handleToggleScreenShare().then(() => handleToggleScreenShare());
    }
  };

  const handleStartCallWithUser = (targetUserId: string, type: 'voice' | 'video') => {
    const callRoom = `lune_call_${[luneUser?.id, targetUserId].sort().join('_').slice(0, 16)}`;
    handleJoinRoom(callRoom);
    showToast(`Iniciando chamada ${type === 'video' ? 'de vídeo' : 'de voz'}...`);
  };

  const handleOpenConversationWithUser = async (targetUserId: string) => {
    const token = localStorage.getItem('lune_session_token');
    if (!token) return;
    try {
      const res = await fetch('/api/conversations/dm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (res.ok && data.conversationId) {
        await fetchConversations();
        setSelectedConversationId(data.conversationId);
        setCurrentNav('CHATS');
      }
    } catch {
      // ignore
    }
  };

  const handleUpdatePresence = async (newPresence: LunePresence) => {
    setShowPresenceMenu(false);
    if (!luneUser) return;
    const token = localStorage.getItem('lune_session_token');
    if (!token) return;

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ presence: newPresence }),
      });
      if (res.ok) {
        setLuneUser((prev) => (prev ? { ...prev, presence: newPresence } : null));
        showToast(`Status alterado para ${newPresence}`);
      }
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('lune_session_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    localStorage.removeItem('lune_session_token');
    setLuneUser(null);
    setConversations([]);
    setSelectedConversationId(null);
    setIsAuthModalOpen(true);
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  // Filter conversations by search
  const filteredConversations = conversations.filter((c) => {
    const q = convSearch.toLowerCase();
    const other = c.members.find((m) => m.userId !== luneUser?.id);
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (other && other.displayName.toLowerCase().includes(q)) ||
      (other && other.username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col md:flex-row h-screen h-[100dvh] w-screen bg-[#060608] text-slate-100 overflow-hidden font-sans antialiased">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#0e0e13]/90 backdrop-blur-xl border border-white/20 text-xs font-semibold text-white shadow-2xl animate-fade-in flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-slate-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. LEFT NARROW NAVIGATION RAIL (Desktop only: Y2K Gothic Liquid Glass) */}
      <aside className="hidden md:flex w-16 sm:w-[72px] flex-col items-center py-4 justify-between border-r border-white/[0.08] bg-[#08080b]/90 backdrop-blur-2xl z-20 shrink-0">
        <div className="flex flex-col items-center space-y-4 w-full">
          {/* Official LUNE Cat Head Brand Logo */}
          <div
            className="w-11 h-11 rounded-2xl p-1.5 flex items-center justify-center bg-white/[0.04] border border-white/15 hover:border-white/40 hover:bg-white/10 transition cursor-pointer shadow-lg relative group"
            onClick={() => setIsSecurityOpen(true)}
            title="LUNE Platform"
          >
            <img src={LUNE_LOGO_URL} alt="LUNE" className="w-full h-full object-contain filter drop-shadow" />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#08080b]" />
          </div>

          <div className="w-8 h-[1px] bg-white/[0.08]" />

          {/* Navigation Tab: Chats & DMs */}
          <button
            type="button"
            onClick={() => setCurrentNav('CHATS')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition relative group ${
              currentNav === 'CHATS'
                ? 'bg-white text-black shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Mensagens & DMs"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Navigation Tab: Friends */}
          <button
            type="button"
            onClick={() => setCurrentNav('FRIENDS')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition relative group ${
              currentNav === 'FRIENDS'
                ? 'bg-white text-black shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Amigos"
          >
            <Users className="w-5 h-5" />
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-400 text-black text-[10px] font-bold animate-pulse shadow-md">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          {/* Navigation Tab: WebRTC Screen Share & Calls */}
          <button
            type="button"
            onClick={() => setCurrentNav('STREAM')}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition relative group ${
              currentNav === 'STREAM'
                ? 'bg-white text-black shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Transmissão de Tela (30/60 FPS) & Voz"
          >
            <Video className="w-5 h-5" />
            {roomId && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse border-2 border-[#08080b]" />
            )}
          </button>
        </div>

        {/* Bottom Utility Tools: Security PIN, Sessions & Settings */}
        <div className="flex flex-col items-center space-y-3 w-full">
          <button
            type="button"
            onClick={() => setIsSessionsModalOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition"
            title="Dispositivos & Sessões Ativas"
          >
            <Monitor className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setSecurityModalInitialTab('NAME');
              setIsSecurityPinModalOpen(true);
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition"
            title="Segurança & Security PIN"
          >
            <Shield className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition"
            title="Configurações & 60 FPS"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User Profile Avatar with Presence Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (!luneUser) {
                  setIsAuthModalOpen(true);
                } else {
                  setShowPresenceMenu((p) => !p);
                }
              }}
              className="p-0.5 rounded-xl hover:ring-2 hover:ring-white/30 transition relative"
              title={luneUser ? `@${luneUser.username}` : 'Entrar / Criar Conta'}
            >
              <LuneAvatar
                src={luneUser?.avatar || LUNE_LOGO_URL}
                name={luneUser?.displayName || 'Convidado'}
                status={luneUser?.presence || 'OFFLINE'}
                size="sm"
              />
            </button>

            {/* Quick Profile & Presence Dropdown */}
            {showPresenceMenu && luneUser && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowPresenceMenu(false)}
                />
                <div className="fixed bottom-20 right-3 sm:absolute sm:left-14 sm:bottom-0 sm:right-auto z-50 w-60 p-2.5 rounded-2xl bg-[#0f0f14]/98 backdrop-blur-2xl border border-white/15 shadow-2xl text-xs space-y-2 animate-fade-in">
                  <div className="p-2 border-b border-white/10 text-left">
                    <span className="font-bold text-white block">{luneUser.displayName}</span>
                    <span className="text-[11px] text-slate-400 font-mono">@{luneUser.username}</span>
                    {luneUser.role === 'ADMIN' && (
                      <span className="inline-block mt-1 px-1.5 py-0.2 rounded bg-white/10 text-[9px] font-bold text-slate-300">
                        ADMINISTRADOR
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-left">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 px-2">Definir Status</span>
                    {(['ONLINE', 'IDLE', 'DO_NOT_DISTURB', 'GHOST', 'OFFLINE'] as LunePresence[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          handleUpdatePresence(st);
                          setShowPresenceMenu(false);
                        }}
                        className={`w-full text-left px-2 py-2 rounded-xl hover:bg-white/10 transition flex items-center justify-between min-h-[36px] ${
                          luneUser.presence === st ? 'text-white font-semibold bg-white/5' : 'text-slate-300'
                        }`}
                      >
                        <span className="capitalize">{st.toLowerCase().replace(/_/g, ' ')}</span>
                        {luneUser.presence === st && <span className="text-emerald-400 text-xs">✓</span>}
                      </button>
                    ))}
                  </div>

                  <div className="pt-1 border-t border-white/10 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPresenceMenu(false);
                        setSecurityModalInitialTab('NAME');
                        setIsSecurityPinModalOpen(true);
                      }}
                      className="w-full text-left px-2 py-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition min-h-[36px]"
                    >
                      Alterar Nome (7d Cooldown)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPresenceMenu(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-2 py-2 rounded-xl hover:bg-red-500/15 text-red-300 transition flex items-center gap-1.5 min-h-[36px]"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sair da Conta
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* 2. CHATS SIDEBAR (Only visible when currentNav === 'CHATS') */}
      {currentNav === 'CHATS' && (
        <div
          className={`${
            selectedConversationId ? 'hidden md:flex' : 'flex'
          } w-full md:w-72 flex-col border-r border-white/[0.08] bg-[#0a0a0d]/80 backdrop-blur-xl shrink-0 h-full pb-20 md:pb-0`}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-sm font-bold text-white tracking-wide">Mensagens Diretas</span>
            <button
              type="button"
              onClick={() => setCurrentNav('FRIENDS')}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition"
              title="Adicionar Novo Amigo"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Search Conversations */}
          <div className="p-3 border-b border-white/[0.05]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                <span>Nenhuma conversa ativa.</span>
                <LuneButton
                  variant="obsidian"
                  size="sm"
                  className="w-full"
                  onClick={() => setCurrentNav('FRIENDS')}
                >
                  Ver Lista de Amigos
                </LuneButton>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.id === selectedConversationId;
                const other = c.type === 'DM' ? c.members.find((m) => m.userId !== luneUser?.id) : null;
                const convTitle = c.name || other?.displayName || 'Conversa LUNE';
                const convAvatar = c.icon || other?.avatar || LUNE_LOGO_URL;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedConversationId(c.id)}
                    className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition text-left ${
                      isSelected
                        ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                        : 'bg-transparent text-slate-300 hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <LuneAvatar
                      src={convAvatar}
                      name={convTitle}
                      status={other?.presence || 'ONLINE'}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold truncate text-white">{convTitle}</span>
                        {c.lastMessage && (
                          <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                            {new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {c.lastMessage?.content || 'Inicie a conversa...'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3. CENTER MAIN WORKSPACE */}
      <main
        className={`${
          currentNav === 'CHATS' && !selectedConversationId ? 'hidden md:flex' : 'flex'
        } flex-1 flex-col h-full overflow-hidden relative ${
          currentNav === 'STREAM' || currentNav === 'FRIENDS' || !luneUser ? 'pb-16 md:pb-0' : ''
        }`}
      >
        {/* VIEW: CHATS */}
        {currentNav === 'CHATS' && (
          selectedConversation && luneUser ? (
            <LuneChatView
              conversation={selectedConversation}
              currentUser={luneUser}
              onStartCall={handleStartCallWithUser}
              onBackMobile={() => setSelectedConversationId(null)}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl p-3 bg-white/[0.03] border border-white/10 shadow-2xl flex items-center justify-center">
                <img src={LUNE_LOGO_URL} alt="LUNE" className="w-full h-full object-contain filter drop-shadow" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Bem-vindo ao LUNE</h2>
                <p className="text-xs text-slate-400 max-w-sm">
                  Selecione uma conversa ao lado ou vá para a aba de Amigos para enviar mensagens criptografadas e compartilhar sua tela.
                </p>
              </div>
              <LuneButton variant="chrome" onClick={() => setCurrentNav('FRIENDS')}>
                Ver Amigos & Pedidos
              </LuneButton>
            </div>
          )
        )}

        {/* VIEW: FRIENDS */}
        {currentNav === 'FRIENDS' && luneUser && (
          <LuneFriendsView
            currentUser={luneUser}
            onOpenConversation={handleOpenConversationWithUser}
            onStartCall={handleStartCallWithUser}
            initialAddUsername={inviteParamUser || undefined}
          />
        )}

        {/* VIEW: GUEST VIEW (When not logged in) */}
        {!luneUser && !authChecking && (
          <div className="h-full flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-lg mx-auto">
            <div className="w-20 h-20 rounded-3xl p-4 bg-white/[0.04] border border-white/10 shadow-2xl flex items-center justify-center relative">
              <img src={LUNE_LOGO_URL} alt="LUNE" className="w-full h-full object-contain filter drop-shadow" />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0a0a0d] animate-pulse" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>SERVIDORES LUNE 100% ONLINE</span>
              </div>

              {inviteParamUser ? (
                <div className="pt-2">
                  <h2 className="text-xl font-bold text-white">
                    @{inviteParamUser} te convidou para o LUNE!
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                    Crie sua conta em 10 segundos ou faça login para se conectar com @{inviteParamUser}, trocar mensagens privadas e compartilhar sua tela a 60 FPS.
                  </p>
                </div>
              ) : (
                <div className="pt-2">
                  <h2 className="text-xl font-bold text-white">Rede Privada LUNE</h2>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Mensagens diretas criptografadas, chamadas de voz e compartilhamento de tela com amigos.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
              <LuneButton
                variant="chrome"
                className="w-full justify-center text-sm py-2.5 shadow-lg"
                onClick={() => setIsAuthModalOpen(true)}
              >
                {inviteParamUser ? 'Aceitar Convite & Entrar' : 'Criar Conta / Entrar'}
              </LuneButton>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full pt-4 border-t border-white/5 text-[11px] text-slate-400">
              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-emerald-400 font-bold block">P2P Mesh</span>
                <span>WebRTC Direto</span>
              </div>
              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-indigo-400 font-bold block">E2EE</span>
                <span>Criptografia</span>
              </div>
              <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-white font-bold block">60 FPS</span>
                <span>Stream Fluido</span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: STREAM & WEBRTC CALLS */}
        {currentNav === 'STREAM' && (
          <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-black">
            {/* Call Header Bar */}
            <Header
              currentUser={{
                id: luneUser?.id || 'me',
                name: luneUser?.displayName || 'Você',
                tag: `@${luneUser?.username || 'user'}`,
                avatarColor: '#d1d5db',
              }}
              roomId={roomId}
              settings={settings}
              participantCount={activePeers.length + 1}
              onOpenFriends={() => setCurrentNav('FRIENDS')}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenSecurity={() => setIsSecurityOpen(true)}
              onOpenJoinRoom={() => setIsJoinRoomOpen(true)}
              onOpenChat={() => setIsStreamChatOpen((p) => !p)}
              onOpenFileTransfer={() => setIsFileTransferOpen(true)}
              unreadChatCount={0}
              onLeaveRoom={handleLeaveRoom}
            />

            {/* Video Mesh Stage */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
              <VideoGrid
                localStream={localStream}
                screenStream={screenStream}
                peers={activePeers}
                isScreenSharing={isScreenSharing}
                currentUser={{
                  id: luneUser?.id || 'me',
                  name: luneUser?.displayName || 'Você',
                  tag: `@${luneUser?.username || 'user'}`,
                  avatarColor: '#d1d5db',
                }}
              />
            </div>

            {/* Bottom Control Bar */}
            <ControlBar
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              isScreenSharing={isScreenSharing}
              preferredFps={settings.preferredFps}
              onToggleMute={handleToggleMute}
              onToggleVideo={handleToggleVideo}
              onToggleScreenShare={handleToggleScreenShare}
              onSetFps={handleSetFps}
              onLeaveRoom={handleLeaveRoom}
              onJoinRoomClick={() => setIsJoinRoomOpen(true)}
              isInRoom={Boolean(roomId)}
            />
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (Visible on screens < 768px when not in active chat) */}
      {!(currentNav === 'CHATS' && selectedConversationId) && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#08080b]/98 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around z-40 px-1 pb-safe">
          {/* Chats */}
          <button
            type="button"
            onClick={() => {
              setCurrentNav('CHATS');
              setSelectedConversationId(null);
            }}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition min-w-[54px] min-h-[44px] active:scale-95 ${
              currentNav === 'CHATS' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-xl ${currentNav === 'CHATS' ? 'bg-white/15 text-white' : ''}`}>
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium mt-0.5">Chats</span>
          </button>

          {/* Friends */}
          <button
            type="button"
            onClick={() => setCurrentNav('FRIENDS')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition min-w-[54px] min-h-[44px] active:scale-95 relative ${
              currentNav === 'FRIENDS' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-xl relative ${currentNav === 'FRIENDS' ? 'bg-white/15 text-white' : ''}`}>
              <Users className="w-5 h-5" />
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-400 text-black text-[9px] font-bold animate-pulse">
                  {pendingRequestsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium mt-0.5">Amigos</span>
          </button>

          {/* Stream */}
          <button
            type="button"
            onClick={() => setCurrentNav('STREAM')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition min-w-[54px] min-h-[44px] active:scale-95 relative ${
              currentNav === 'STREAM' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-xl relative ${currentNav === 'STREAM' ? 'bg-white/15 text-white' : ''}`}>
              <Video className="w-5 h-5" />
              {roomId && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] font-medium mt-0.5">Transmissão</span>
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-3 rounded-xl transition min-w-[54px] min-h-[44px] active:scale-95 text-slate-400 hover:text-slate-200"
          >
            <div className="p-1">
              <Settings className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium mt-0.5">Ajustes</span>
          </button>

          {/* Profile / Auth */}
          <button
            type="button"
            onClick={() => {
              if (!luneUser) {
                setIsAuthModalOpen(true);
              } else {
                setShowPresenceMenu((p) => !p);
              }
            }}
            className="flex flex-col items-center justify-center py-1 px-3 rounded-xl transition min-w-[54px] min-h-[44px] active:scale-95 text-slate-400 hover:text-slate-200"
          >
            <LuneAvatar
              src={luneUser?.avatar || LUNE_LOGO_URL}
              name={luneUser?.displayName || 'Convidado'}
              status={luneUser?.presence || 'OFFLINE'}
              size="xs"
            />
            <span className="text-[10px] font-medium mt-0.5 truncate max-w-[50px]">
              {luneUser ? `@${luneUser.username}` : 'Entrar'}
            </span>
          </button>
        </nav>
      )}

      {/* MODALS */}
      {/* 1. LUNE Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          setLuneUser(user);
          fetchConversations();
          showToast(`Bem-vindo, @${user.username}!`);
        }}
      />

      {/* 2. Security PIN & 7-day Cooldown Modal */}
      {luneUser && (
        <SecurityPinModal
          isOpen={isSecurityPinModalOpen}
          onClose={() => setIsSecurityPinModalOpen(false)}
          currentUser={luneUser}
          initialAction={securityModalInitialTab}
          onUserUpdated={(updated) => {
            setLuneUser((prev) => (prev ? { ...prev, ...updated } : null));
          }}
        />
      )}

      {/* 3. Active Sessions Modal */}
      <SessionsModal
        isOpen={isSessionsModalOpen}
        onClose={() => setIsSessionsModalOpen(false)}
        onLoggedOutCurrent={handleLogout}
      />

      {/* 4. App Settings & 60 FPS Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSet) => {
          setSettings(newSet);
          localStorage.setItem('lune_settings', JSON.stringify(newSet));
          showToast('Configurações salvas!');
        }}
      />

      {/* 5. Security Fingerprint & E2EE Info */}
      <SecurityBadgeModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
        fingerprint={fingerprint}
        roomId={roomId || 'lune_main'}
      />

      {/* 6. Join Room Modal */}
      <JoinRoomModal
        isOpen={isJoinRoomOpen}
        onClose={() => setIsJoinRoomOpen(false)}
        onJoin={(targetRoom, key) => {
          handleJoinRoom(targetRoom, key);
          setIsJoinRoomOpen(false);
        }}
      />

      {/* 7. File Transfer Panel */}
      <FileTransferPanel
        isOpen={isFileTransferOpen}
        onClose={() => setIsFileTransferOpen(false)}
        files={sharedFiles}
        onSendFile={(file) => {
          if (webrtcManagerRef.current && activePeers.length > 0) {
            const senderUser = {
              id: luneUser?.id || 'me',
              name: luneUser?.displayName || 'Você',
              tag: `@${luneUser?.username || 'user'}`,
              avatarColor: '#d1d5db',
            };
            activePeers.forEach((p) => {
              if (p.dataChannel && p.dataChannel.readyState === 'open') {
                sendFileOverDataChannel(
                  file,
                  senderUser,
                  (payload) => {
                    p.dataChannel?.send(JSON.stringify(payload));
                  },
                  (fileId, progress, status) => {
                    console.log(`Sending progress: ${progress}% status: ${status}`);
                  }
                );
              }
            });
            showToast(`Enviando "${file.name}"...`);
          } else {
            showToast('Nenhum amigo conectado na sala para receber o arquivo');
          }
        }}
      />

      {/* 8. Incoming Call Toast */}
      {incomingCall && (
        <IncomingCallToast
          call={incomingCall}
          onAccept={(call) => {
            handleJoinRoom(call.roomId);
            setIncomingCall(null);
            stopRingtone();
          }}
          onDecline={() => {
            setIncomingCall(null);
            stopRingtone();
          }}
        />
      )}
    </div>
  );
}
