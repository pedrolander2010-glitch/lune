import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  RefreshCw,
  UserCheck,
  UserX,
  Clock,
  Ban,
} from 'lucide-react';
import { LuneFriend, LuneUser } from '../../types';
import {
  supabase,
  isSupabaseConfigured,
  fetchUserSocialData,
  searchProfilesByUsername,
  sendFriendRequest,
  acceptFriendRequestRpc,
  updateFriendRequestStatus,
  removeFriendRpc,
  blockUser,
  unblockUser,
} from '../../lib/supabase';

export interface LuneFriendsViewProps {
  currentUser: LuneUser;
  onOpenConversation: (targetUserId: string) => void;
  onStartCall: (targetUserId: string, type: 'voice' | 'video') => void;
  initialAddUsername?: string;
  onPendingCountChange?: (count: number) => void;
}

export const LuneFriendsView: React.FC<LuneFriendsViewProps> = ({
  currentUser,
  onOpenConversation,
  onStartCall,
  initialAddUsername,
  onPendingCountChange,
}) => {
  const [activeTab, setActiveTab] = useState<'ONLINE' | 'ALL' | 'PENDING' | 'BLOCKED' | 'ADD'>('ONLINE');
  const [friends, setFriends] = useState<LuneFriend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<LuneFriend[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<LuneFriend[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<LuneFriend[]>([]);
  const [loading, setLoading] = useState(true);

  // Search in friend list
  const [searchQuery, setSearchQuery] = useState('');

  // Global Add Friend Directory Search
  const [addUsernameInput, setAddUsernameInput] = useState(initialAddUsername || '');
  const [searchResults, setSearchResults] = useState<LuneUser[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch Remote Social Data from PostgreSQL
  const loadSocialData = useCallback(async () => {
    if (!isSupabaseConfigured() || !currentUser?.id) {
      setLoading(false);
      return;
    }

    try {
      const data = await fetchUserSocialData(currentUser.id);
      setFriends(data.friends);
      setIncomingRequests(data.incomingRequests);
      setOutgoingRequests(data.outgoingRequests);
      setBlockedUsers(data.blockedUsers);

      if (onPendingCountChange) {
        onPendingCountChange(data.incomingRequests.length);
      }
    } catch (err) {
      console.error('Failed to load social data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, onPendingCountChange]);

  useEffect(() => {
    loadSocialData();
  }, [loadSocialData]);

  // 2. Realtime Subscriptions for Friend Requests & Friendships
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser?.id) return;

    const channel = supabase
      .channel(`social-updates-${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
        },
        () => {
          loadSocialData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        () => {
          loadSocialData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, loadSocialData]);

  // 3. Debounced Global Search in Remote PostgreSQL Profiles
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const clean = addUsernameInput.trim();
    if (!clean || clean.length < 2) {
      setSearchResults([]);
      setSearchingGlobal(false);
      return;
    }

    setSearchingGlobal(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchProfilesByUsername(clean, currentUser.id);
        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearchingGlobal(false);
      }
    }, 350);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [addUsernameInput, currentUser.id]);

  // 4. Send Friend Request
  const handleSendFriendRequest = async (targetUser: LuneUser) => {
    setActionInProgress(targetUser.id);
    setAddMsg(null);

    const res = await sendFriendRequest(currentUser.id, targetUser.id);
    if (res.success) {
      setAddMsg({
        type: 'success',
        text: `Solicitação de amizade enviada para @${targetUser.username}!`,
      });
      loadSocialData();
    } else {
      setAddMsg({
        type: 'error',
        text: res.error || 'Não foi possível enviar a solicitação.',
      });
    }
    setActionInProgress(null);
  };

  // 5. Accept Friend Request
  const handleAcceptRequest = async (requestId: string) => {
    setActionInProgress(requestId);
    const res = await acceptFriendRequestRpc(requestId);
    if (res.success) {
      loadSocialData();
    } else {
      alert(res.error || 'Erro ao aceitar pedido.');
    }
    setActionInProgress(null);
  };

  // 6. Decline Friend Request
  const handleDeclineRequest = async (requestId: string) => {
    setActionInProgress(requestId);
    await updateFriendRequestStatus(requestId, 'declined');
    loadSocialData();
    setActionInProgress(null);
  };

  // 7. Cancel Outgoing Friend Request
  const handleCancelRequest = async (requestId: string) => {
    setActionInProgress(requestId);
    await updateFriendRequestStatus(requestId, 'cancelled');
    loadSocialData();
    setActionInProgress(null);
  };

  // 8. Remove Friend
  const handleRemoveFriend = async (targetUserId: string) => {
    if (!window.confirm('Tem certeza que deseja desfazer a amizade?')) return;
    setActionInProgress(targetUserId);
    await removeFriendRpc(targetUserId);
    loadSocialData();
    setActionInProgress(null);
  };

  // 9. Block User
  const handleBlockUser = async (targetUserId: string) => {
    if (!window.confirm('Bloquear este usuário? Ele não poderá enviar mensagens ou solicitações.')) return;
    setActionInProgress(targetUserId);
    await blockUser(currentUser.id, targetUserId);
    loadSocialData();
    setActionInProgress(null);
  };

  // 10. Unblock User
  const handleUnblockUser = async (targetUserId: string) => {
    setActionInProgress(targetUserId);
    await unblockUser(currentUser.id, targetUserId);
    loadSocialData();
    setActionInProgress(null);
  };

  // Copy Profile Invite Link
  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=@${currentUser.username}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  // Filtered Friends List
  const filteredFriends = friends.filter((f) => {
    if (activeTab === 'ONLINE' && f.presence === 'OFFLINE') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return f.username.toLowerCase().includes(q) || f.displayName.toLowerCase().includes(q);
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07070a]/90 text-slate-100 overflow-hidden select-none">
      {/* Top Header & Tab Navigation */}
      <div className="h-16 px-4 sm:px-6 border-b border-white/10 flex items-center justify-between bg-[#0a0a0f]/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
            <Users className="w-4 h-4" />
          </div>
          <h2 className="text-sm sm:text-base font-bold tracking-tight text-white">Amigos</h2>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1">
          <button
            onClick={() => setActiveTab('ONLINE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'ONLINE'
                ? 'bg-white/15 text-white border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            Online
            <span className="text-[10px] opacity-70">
              ({friends.filter((f) => f.presence !== 'OFFLINE').length})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'ALL'
                ? 'bg-white/15 text-white border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Todos
            <span className="ml-1 text-[10px] opacity-70">({friends.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition relative flex items-center gap-1.5 ${
              activeTab === 'PENDING'
                ? 'bg-white/15 text-white border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Pendentes
            {incomingRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px] font-bold animate-pulse">
                {incomingRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('BLOCKED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              activeTab === 'BLOCKED'
                ? 'bg-white/15 text-white border border-white/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Bloqueados
          </button>

          <button
            onClick={() => setActiveTab('ADD')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'ADD'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Adicionar Amigo
          </button>
        </div>
      </div>

      {/* Main View Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* ADD FRIEND TAB */}
        {activeTab === 'ADD' && (
          <div className="max-w-2xl mx-auto space-y-6 text-left">
            <div className="p-5 rounded-2xl bg-[#0e0f18]/80 border border-white/10 space-y-4 backdrop-blur-xl">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  Diretório Global de Usuários LUNE
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Pesquise pelo <strong className="text-indigo-300">@username</strong> exato para encontrar qualquer usuário cadastrado no servidor compartilhado.
                </p>
              </div>

              {/* Search Input */}
              <div className="relative">
                <LuneInput
                  label="Buscar por @username ou Nome"
                  placeholder="ex: pedro, carlos, lander..."
                  value={addUsernameInput}
                  onChange={(e) => setAddUsernameInput(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
                {searchingGlobal && (
                  <div className="absolute right-3 top-9">
                    <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                  </div>
                )}
              </div>

              {addMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    addMsg.type === 'success'
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/15 border border-red-500/30 text-red-300'
                  }`}
                >
                  {addMsg.text}
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                    Usuários Encontrados no Servidor ({searchResults.length})
                  </span>
                  <div className="space-y-2">
                    {searchResults.map((user) => {
                      const isAlreadyFriend = friends.some((f) => f.userId === user.id);
                      const isPendingSent = outgoingRequests.some((r) => r.userId === user.id);
                      const isPendingReceived = incomingRequests.some((r) => r.userId === user.id);

                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition"
                        >
                          <div className="flex items-center gap-3">
                            <LuneAvatar
                              src={user.avatar}
                              alt={user.displayName}
                              size="md"
                              presence={user.presence}
                            />
                            <div>
                              <div className="font-semibold text-sm text-white">
                                {user.displayName}
                              </div>
                              <div className="text-xs text-indigo-400 font-mono">
                                @{user.username}
                              </div>
                            </div>
                          </div>

                          <div>
                            {isAlreadyFriend ? (
                              <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-semibold text-slate-300 flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                Amigos
                              </span>
                            ) : isPendingSent ? (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-300 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                Pedido Enviado
                              </span>
                            ) : isPendingReceived ? (
                              <LuneButton
                                size="sm"
                                variant="chrome"
                                onClick={() => setActiveTab('PENDING')}
                              >
                                Ver Solicitação
                              </LuneButton>
                            ) : (
                              <LuneButton
                                size="sm"
                                variant="chrome"
                                loading={actionInProgress === user.id}
                                onClick={() => handleSendFriendRequest(user)}
                              >
                                <UserPlus className="w-3.5 h-3.5 mr-1" />
                                Adicionar
                              </LuneButton>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {addUsernameInput.trim().length >= 2 && !searchingGlobal && searchResults.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  Nenhum usuário encontrado com "{addUsernameInput}". Verifique o @username exato.
                </div>
              )}
            </div>

            {/* Invite Link Generator */}
            <div className="p-5 rounded-2xl bg-[#0e0f18]/80 border border-white/10 space-y-3 backdrop-blur-xl">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Seu Link de Convite Direto
                </h4>
                <p className="text-xs text-slate-400">
                  Compartilhe este link com seus amigos para que eles caiam diretamente na tela de solicitação.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 p-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-slate-300 font-mono truncate select-all">
                  {window.location.origin}{window.location.pathname}?invite=@{currentUser.username}
                </div>
                <LuneButton
                  variant="obsidian"
                  size="sm"
                  onClick={handleCopyInviteLink}
                  className="shrink-0"
                >
                  {copiedInvite ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copiar Link
                    </>
                  )}
                </LuneButton>
              </div>
            </div>
          </div>
        )}

        {/* PENDING TAB */}
        {activeTab === 'PENDING' && (
          <div className="max-w-2xl mx-auto space-y-6 text-left">
            {/* Incoming Requests */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Solicitações Recebidas ({incomingRequests.length})
                </span>
                <button
                  onClick={loadSocialData}
                  className="text-slate-400 hover:text-white transition"
                  title="Atualizar"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {incomingRequests.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 text-center text-xs text-slate-400">
                  Nenhuma solicitação de amizade pendente no momento.
                </div>
              ) : (
                <div className="space-y-2">
                  {incomingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-[#0d0e17] border border-indigo-500/20 hover:border-indigo-500/40 transition"
                    >
                      <div className="flex items-center gap-3">
                        <LuneAvatar
                          src={req.avatar}
                          alt={req.displayName}
                          size="md"
                          presence={req.presence}
                        />
                        <div>
                          <div className="font-semibold text-sm text-white">
                            {req.displayName}
                          </div>
                          <div className="text-xs text-indigo-400 font-mono">
                            @{req.username}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <LuneButton
                          size="sm"
                          variant="chrome"
                          loading={actionInProgress === req.id}
                          onClick={() => handleAcceptRequest(req.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Aceitar
                        </LuneButton>
                        <LuneButton
                          size="sm"
                          variant="obsidian"
                          loading={actionInProgress === req.id}
                          onClick={() => handleDeclineRequest(req.id)}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Recusar
                        </LuneButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            <div className="space-y-3 pt-4 border-t border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Solicitações Enviadas ({outgoingRequests.length})
              </span>

              {outgoingRequests.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">
                  Você não enviou nenhuma solicitação pendente.
                </div>
              ) : (
                <div className="space-y-2">
                  {outgoingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <LuneAvatar
                          src={req.avatar}
                          alt={req.displayName}
                          size="sm"
                          presence={req.presence}
                        />
                        <div>
                          <div className="font-semibold text-sm text-white">
                            {req.displayName}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            @{req.username}
                          </div>
                        </div>
                      </div>

                      <LuneButton
                        size="sm"
                        variant="obsidian"
                        loading={actionInProgress === req.id}
                        onClick={() => handleCancelRequest(req.id)}
                      >
                        Cancelar
                      </LuneButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BLOCKED TAB */}
        {activeTab === 'BLOCKED' && (
          <div className="max-w-2xl mx-auto space-y-3 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Usuários Bloqueados ({blockedUsers.length})
            </span>

            {blockedUsers.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 text-center text-xs text-slate-400">
                Nenhum usuário bloqueado.
              </div>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <LuneAvatar src={user.avatar} alt={user.displayName} size="md" />
                      <div>
                        <div className="font-semibold text-sm text-white">
                          {user.displayName}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          @{user.username}
                        </div>
                      </div>
                    </div>

                    <LuneButton
                      size="sm"
                      variant="obsidian"
                      loading={actionInProgress === user.id}
                      onClick={() => handleUnblockUser(user.userId)}
                    >
                      Desbloquear
                    </LuneButton>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ONLINE & ALL FRIENDS TABS */}
        {(activeTab === 'ONLINE' || activeTab === 'ALL') && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Search filter in friends */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 max-w-sm">
                <LuneInput
                  placeholder="Filtrar amigos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-3.5 h-3.5" />}
                />
              </div>

              <LuneButton
                size="sm"
                variant="obsidian"
                onClick={loadSocialData}
                className="shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Atualizar
              </LuneButton>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin mx-auto mb-2" />
                Carregando amigos do servidor...
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="p-12 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    {activeTab === 'ONLINE'
                      ? 'Nenhum amigo online no momento.'
                      : 'Você ainda não possui amigos adicionados.'}
                  </p>
                  <p className="text-xs text-slate-400">
                    Acesse a aba <strong>Adicionar Amigo</strong> para pesquisar @usernames e enviar solicitações.
                  </p>
                </div>
                <LuneButton
                  variant="chrome"
                  size="sm"
                  onClick={() => setActiveTab('ADD')}
                  className="mx-auto"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  Pesquisar Usuários
                </LuneButton>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0c0d15]/80 border border-white/10 hover:border-white/20 transition backdrop-blur-xl group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <LuneAvatar
                        src={friend.avatar}
                        alt={friend.displayName}
                        size="md"
                        presence={friend.presence}
                      />
                      <div className="min-w-0 text-left">
                        <div className="font-semibold text-sm text-white truncate flex items-center gap-1.5">
                          {friend.displayName}
                        </div>
                        <div className="text-xs text-indigo-400 font-mono truncate">
                          @{friend.username}
                        </div>
                        {friend.customStatus && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {friend.customStatus}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onOpenConversation(friend.userId)}
                        className="p-2 rounded-xl bg-white/[0.06] hover:bg-indigo-500/20 text-slate-300 hover:text-white border border-white/10 transition"
                        title="Abrir Chat Privado"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onStartCall(friend.userId, 'voice')}
                        className="p-2 rounded-xl bg-white/[0.06] hover:bg-emerald-500/20 text-slate-300 hover:text-white border border-white/10 transition"
                        title="Chamada de Voz"
                      >
                        <Phone className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onStartCall(friend.userId, 'video')}
                        className="p-2 rounded-xl bg-white/[0.06] hover:bg-purple-500/20 text-slate-300 hover:text-white border border-white/10 transition"
                        title="Chamada de Vídeo"
                      >
                        <Video className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleRemoveFriend(friend.userId)}
                        className="p-2 rounded-xl bg-white/[0.06] hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-white/10 transition"
                        title="Desfazer Amizade"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
