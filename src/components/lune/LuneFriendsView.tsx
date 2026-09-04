import React, { useState, useEffect, useCallback } from 'react';
import { LuneAvatar } from './LuneAvatar';
import { LuneButton } from './LuneButton';
import { LuneInput } from './LuneInput';
import {
  Users,
  UserPlus,
  MessageSquare,
  Phone,
  Video,
  Check,
  X,
  ShieldAlert,
  Search,
  Sparkles,
  Copy,
  CheckCheck,
  Server,
  Activity,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { LuneFriend, LuneUser } from '../../types';

export interface LuneFriendsViewProps {
  currentUser: LuneUser;
  onOpenConversation: (targetUserId: string) => void;
  onStartCall: (targetUserId: string, type: 'voice' | 'video') => void;
  initialAddUsername?: string;
}

interface ServerStatusInfo {
  status: string;
  uptimeSeconds: number;
  registeredUsers: number;
  onlineUsers: number;
  activeConnections: number;
  activeRooms: number;
  database: string;
  version: string;
}

interface DiscoveredUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  presence: string;
  customStatus?: string;
  relationship: 'NONE' | 'FRIENDS' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'BLOCKED';
}

export const LuneFriendsView: React.FC<LuneFriendsViewProps> = ({
  currentUser,
  onOpenConversation,
  onStartCall,
  initialAddUsername,
}) => {
  const [activeTab, setActiveTab] = useState<'ONLINE' | 'ALL' | 'PENDING' | 'BLOCKED' | 'ADD'>('ONLINE');
  const [friends, setFriends] = useState<LuneFriend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addUsernameInput, setAddUsernameInput] = useState(initialAddUsername || '');
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Server Status & Live Discovery
  const [serverStatus, setServerStatus] = useState<ServerStatusInfo | null>(null);
  const [discoveredUsers, setDiscoveredUsers] = useState<DiscoveredUser[]>([]);
  const [discoveryQuery, setDiscoveryQuery] = useState('');
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const token = localStorage.getItem('lune_session_token');

  // Fetch Friends List
  const fetchFriends = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/friends', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setFriends(data.friends || []);
      }
    } catch {
      // ignore
    }
  }, [token]);

  // Fetch Server Health & Status
  const fetchServerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setServerStatus(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Users on Server for Discovery
  const fetchDiscoveredUsers = useCallback(async (q: string = '') => {
    if (!token) return;
    setLoadingDiscovery(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDiscoveredUsers(data.users || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDiscovery(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFriends();
    fetchServerStatus();
    const interval = setInterval(() => {
      fetchFriends();
      fetchServerStatus();
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchFriends, fetchServerStatus]);

  useEffect(() => {
    if (activeTab === 'ADD') {
      fetchDiscoveredUsers(discoveryQuery);
    }
  }, [activeTab, discoveryQuery, fetchDiscoveredUsers]);

  const handleSendFriendRequest = async (e?: React.FormEvent, targetUsername?: string) => {
    if (e) e.preventDefault();
    const toSend = targetUsername || addUsernameInput.trim();
    if (!toSend) return;

    setAddLoading(true);
    setAddMsg(null);
    setActionInProgress(toSend);

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: toSend }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAddMsg({ type: 'error', text: data.message || 'Erro ao enviar pedido de amizade.' });
        return;
      }

      setAddMsg({ type: 'success', text: data.message || 'Pedido processado com sucesso!' });
      if (!targetUsername) {
        setAddUsernameInput('');
      }
      fetchFriends();
      fetchDiscoveredUsers(discoveryQuery);
    } catch {
      setAddMsg({ type: 'error', text: 'Falha de conexão com o servidor. Tente novamente.' });
    } finally {
      setAddLoading(false);
      setActionInProgress(null);
    }
  };

  const handleRespond = async (friendshipId: string, action: 'ACCEPT' | 'DECLINE' | 'BLOCK' | 'REMOVE') => {
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendshipId, action }),
      });
      if (res.ok) {
        fetchFriends();
        fetchDiscoveredUsers(discoveryQuery);
      }
    } catch {
      // ignore
    }
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/?invite=${currentUser.username}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  const pendingList = friends.filter((f) => f.status === 'PENDING');
  const acceptedList = friends.filter((f) => f.status === 'ACCEPTED');
  const onlineList = acceptedList.filter((f) => f.presence === 'ONLINE' || f.presence === 'STREAMING');
  const blockedList = friends.filter((f) => f.status === 'BLOCKED');

  const filteredAccepted = acceptedList.filter((f) => {
    const q = searchQuery.toLowerCase();
    return (
      f.displayName.toLowerCase().includes(q) ||
      f.username.toLowerCase().includes(q)
    );
  });

  const filteredOnline = onlineList.filter((f) => {
    const q = searchQuery.toLowerCase();
    return (
      f.displayName.toLowerCase().includes(q) ||
      f.username.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#08080a]/60 backdrop-blur-2xl">
      {/* Top Bar with Navigation Tabs, Server Health Pill & Friend Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 sm:p-4 border-b border-white/[0.08] gap-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-1 sm:pb-0 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ONLINE')}
            className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95 transition ${
              activeTab === 'ONLINE'
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Disponíveis ({onlineList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95 transition ${
              activeTab === 'ALL'
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({acceptedList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95 transition ${
              activeTab === 'PENDING'
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pendentes
            {pendingList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-400 text-black text-[10px] font-bold animate-pulse">
                {pendingList.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BLOCKED')}
            className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95 transition ${
              activeTab === 'BLOCKED'
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bloqueados ({blockedList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ADD')}
            className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95 transition ${
              activeTab === 'ADD'
                ? 'bg-white text-black shadow-sm font-bold'
                : 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" /> Adicionar Amigo
          </button>
        </div>

        {/* Server Status Pill */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">Servidor Online</span>
            {serverStatus && (
              <span className="text-[10px] text-emerald-400/80 font-mono hidden md:inline">
                • {serverStatus.registeredUsers} usuários
              </span>
            )}
          </div>

          {activeTab !== 'ADD' && (
            <div className="relative w-full sm:w-56 mt-1 sm:mt-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar em amigos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 sm:py-1.5 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Friends View Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-24 md:pb-6 custom-scrollbar">
        {/* TAB: ADD FRIEND */}
        {activeTab === 'ADD' && (
          <div className="max-w-2xl mx-auto space-y-6 pt-2 text-left">
            {/* Header & Server Online Confirmation */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900/20 via-white/[0.02] to-transparent border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Servidores LUNE 100% Ativos & Conectados
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white">
                  Conecte-se e converse em tempo real com seus amigos
                </h3>
                <p className="text-[11px] text-slate-400">
                  Adicione pelo identificador único, envie seu link direto ou adicione usuários cadastrados abaixo.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-black hover:bg-slate-200 text-xs font-bold transition shadow-lg shrink-0"
              >
                {copiedInvite ? (
                  <>
                    <CheckCheck className="w-4 h-4 text-emerald-600" />
                    <span>Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Link de Convite</span>
                  </>
                )}
              </button>
            </div>

            {/* Notifications / Feedback Messages */}
            {addMsg && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
                  addMsg.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/15 border-red-500/30 text-red-300'
                }`}
              >
                <span>{addMsg.text}</span>
                <button
                  type="button"
                  onClick={() => setAddMsg(null)}
                  className="text-xs opacity-70 hover:opacity-100 ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Manual Friend Input Form */}
            <form onSubmit={handleSendFriendRequest} className="space-y-2">
              <label className="text-xs font-semibold text-slate-200 block">
                Adicionar por @username ou e-mail:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-400 font-semibold">
                    @
                  </span>
                  <input
                    type="text"
                    placeholder="Digite ex: lander, carlos ou o e-mail do seu amigo"
                    value={addUsernameInput}
                    onChange={(e) => setAddUsernameInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-3 rounded-xl bg-white/[0.04] border border-white/15 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-400 shadow-inner"
                    required
                  />
                </div>
                <LuneButton
                  type="submit"
                  variant="chrome"
                  size="md"
                  loading={addLoading}
                  disabled={!addUsernameInput.trim()}
                  className="w-full sm:w-auto shrink-0 min-h-[44px]"
                >
                  Enviar Pedido
                </LuneButton>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 pt-1 gap-1">
                <span>
                  Seu @username para amigos te adicionarem:{' '}
                  <strong className="text-white font-mono">@{currentUser.username}</strong>
                </span>
                <span>(Não diferencia maiúsculas)</span>
              </div>
            </form>

            {/* Live Server Directory & Discovery */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Usuários Cadastrados no Servidor
                  </span>
                </div>
                <div className="relative w-48">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar usuários..."
                    value={discoveryQuery}
                    onChange={(e) => setDiscoveryQuery(e.target.value)}
                    className="w-full pl-7 pr-2 py-1 text-[11px] rounded-lg bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {loadingDiscovery ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-indigo-400" />
                    Buscando contas no servidor...
                  </div>
                ) : discoveredUsers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-white/[0.02] border border-white/5 rounded-2xl">
                    Nenhum outro usuário encontrado. Compartilhe seu link de convite com seu amigo!
                  </div>
                ) : (
                  discoveredUsers.map((u) => {
                    // Check if there is an incoming pending request from this user
                    const incomingPending = pendingList.find(
                      (p) => p.userId === u.id && p.isIncoming
                    );

                    return (
                      <div
                        key={u.id}
                        className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 flex items-center justify-between transition"
                      >
                        <div className="flex items-center gap-3">
                          <LuneAvatar
                            src={u.avatar}
                            name={u.displayName}
                            status={u.presence as any}
                            size="md"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">
                                {u.displayName}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                @{u.username}
                              </span>
                            </div>
                            {u.customStatus ? (
                              <p className="text-[11px] text-slate-400">{u.customStatus}</p>
                            ) : (
                              <p className="text-[10px] text-slate-500">Membro da rede LUNE</p>
                            )}
                          </div>
                        </div>

                        <div>
                          {u.relationship === 'FRIENDS' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-emerald-400 font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                Amigos ✓
                              </span>
                              <button
                                type="button"
                                onClick={() => onOpenConversation(u.id)}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                                title="Abrir Conversa"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : incomingPending ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRespond(incomingPending.id, 'ACCEPT')}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition shadow-sm"
                              >
                                <Check className="w-3.5 h-3.5" /> Aceitar Pedido
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRespond(incomingPending.id, 'DECLINE')}
                                className="p-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition"
                                title="Recusar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : u.relationship === 'PENDING_SENT' ? (
                            <span className="text-[11px] text-amber-300 font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                              Pedido Enviado...
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSendFriendRequest(undefined, u.username)}
                              disabled={actionInProgress === u.username}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white text-slate-200 hover:text-black text-xs font-semibold transition shadow-sm"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              {actionInProgress === u.username ? 'Adicionando...' : 'Adicionar'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: PENDING REQUESTS */}
        {activeTab === 'PENDING' && (
          <div className="space-y-3 max-w-2xl mx-auto">
            {pendingList.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 border border-white/5 rounded-2xl">
                Nenhum pedido de amizade pendente no momento.
              </div>
            ) : (
              pendingList.map((f) => (
                <div
                  key={f.id}
                  className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between hover:border-white/20 transition"
                >
                  <div className="flex items-center gap-3">
                    <LuneAvatar
                      src={f.avatar}
                      name={f.displayName}
                      status={f.presence}
                      size="md"
                    />
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {f.displayName}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          @{f.username}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {f.isIncoming ? 'Quer ser seu amigo' : 'Pedido de amizade enviado'}
                      </span>
                    </div>
                  </div>

                  {f.isIncoming ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRespond(f.id, 'ACCEPT')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                        title="Aceitar Pedido"
                      >
                        <Check className="w-3.5 h-3.5" /> Aceitar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespond(f.id, 'DECLINE')}
                        className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition"
                        title="Recusar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRespond(f.id, 'DECLINE')}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-400 hover:text-white transition"
                    >
                      Cancelar Pedido
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: ONLINE & ALL FRIENDS */}
        {(activeTab === 'ONLINE' || activeTab === 'ALL') && (
          <div className="space-y-2 max-w-3xl mx-auto">
            {((activeTab === 'ONLINE' ? filteredOnline : filteredAccepted).length === 0) ? (
              <div className="py-16 text-center text-xs text-slate-400 border border-white/5 rounded-2xl space-y-3">
                <p>
                  {activeTab === 'ONLINE'
                    ? 'Nenhum amigo online agora.'
                    : 'Você ainda não possui amigos adicionados.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('ADD')}
                  className="px-4 py-2 rounded-xl bg-white text-black hover:bg-slate-200 text-xs font-bold transition inline-flex items-center gap-1.5 shadow-lg"
                >
                  <UserPlus className="w-4 h-4" /> Adicionar Amigo ou Convidar
                </button>
              </div>
            ) : (
              (activeTab === 'ONLINE' ? filteredOnline : filteredAccepted).map((f) => (
                <div
                  key={f.id}
                  className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.04] flex items-center justify-between transition group"
                >
                  <div className="flex items-center gap-3">
                    <LuneAvatar
                      src={f.avatar}
                      name={f.displayName}
                      status={f.presence}
                      size="md"
                    />
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white group-hover:text-slate-100 transition">
                          {f.displayName}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          @{f.username}
                        </span>
                      </div>
                      {f.customStatus && (
                        <p className="text-[11px] text-slate-400 mt-0.5 max-w-md truncate">
                          {f.customStatus}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenConversation(f.userId)}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition"
                      title="Abrir Chat Privado"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCall(f.userId, 'voice')}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition"
                      title="Iniciar Chamada de Voz"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCall(f.userId, 'video')}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition"
                      title="Chamada de Vídeo / Compartilhar Tela"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: BLOCKED */}
        {activeTab === 'BLOCKED' && (
          <div className="space-y-3 max-w-2xl mx-auto">
            {blockedList.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 border border-white/5 rounded-2xl">
                Você não possui contatos bloqueados.
              </div>
            ) : (
              blockedList.map((f) => (
                <div
                  key={f.id}
                  className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <LuneAvatar
                      src={f.avatar}
                      name={f.displayName}
                      status="OFFLINE"
                      size="md"
                    />
                    <div className="text-left">
                      <span className="text-sm font-semibold text-slate-300">
                        {f.displayName}
                      </span>
                      <span className="text-xs text-slate-500 font-mono block">
                        @{f.username}
                      </span>
                    </div>
                  </div>
                  <LuneButton
                    type="button"
                    variant="obsidian"
                    size="sm"
                    onClick={() => handleRespond(f.id, 'REMOVE')}
                  >
                    Desbloquear
                  </LuneButton>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

