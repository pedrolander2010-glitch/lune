import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { LuneFriend, LuneUser } from '../../types';

export interface LuneFriendsViewProps {
  currentUser: LuneUser;
  onOpenConversation: (targetUserId: string) => void;
  onStartCall: (targetUserId: string, type: 'voice' | 'video') => void;
}

export const LuneFriendsView: React.FC<LuneFriendsViewProps> = ({
  currentUser,
  onOpenConversation,
  onStartCall,
}) => {
  const [activeTab, setActiveTab] = useState<'ONLINE' | 'ALL' | 'PENDING' | 'BLOCKED' | 'ADD'>('ONLINE');
  const [friends, setFriends] = useState<LuneFriend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addUsernameInput, setAddUsernameInput] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const token = localStorage.getItem('lune_session_token');

  const fetchFriends = async () => {
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
  };

  useEffect(() => {
    fetchFriends();
    const interval = setInterval(fetchFriends, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUsernameInput.trim()) return;

    setAddLoading(true);
    setAddMsg(null);

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: addUsernameInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAddMsg({ type: 'error', text: data.message || 'Erro ao enviar pedido de amizade.' });
        setAddLoading(false);
        return;
      }

      setAddMsg({ type: 'success', text: data.message || 'Pedido enviado com sucesso!' });
      setAddUsernameInput('');
      fetchFriends();
    } catch {
      setAddMsg({ type: 'error', text: 'Falha de rede ao enviar solicitação.' });
    } finally {
      setAddLoading(false);
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
      }
    } catch {
      // ignore
    }
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
      {/* Top Bar with Navigation Tabs & Friend Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-4 border-b border-white/[0.08] gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('ONLINE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
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
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
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
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition ${
              activeTab === 'PENDING'
                ? 'bg-white/15 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pendentes
            {pendingList.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-black text-[10px] font-bold">
                {pendingList.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BLOCKED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
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
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition ${
              activeTab === 'ADD'
                ? 'bg-white text-black shadow-sm'
                : 'bg-white/[0.06] text-slate-200 hover:bg-white/15 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" /> Adicionar Amigo
          </button>
        </div>

        {activeTab !== 'ADD' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar amigo por @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
            />
          </div>
        )}
      </div>

      {/* Main Friends View Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {/* TAB: ADD FRIEND */}
        {activeTab === 'ADD' && (
          <div className="max-w-xl mx-auto space-y-6 pt-4 text-left">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-slate-300" />
                Adicionar Amigo no LUNE
              </h3>
              <p className="text-xs text-slate-400">
                Digite o @username exato do seu amigo para enviar um convite privado. O identificador é único e não diferencia maiúsculas de minúsculas.
              </p>
            </div>

            {addMsg && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  addMsg.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/15 border-red-500/30 text-red-300'
                }`}
              >
                {addMsg.text}
              </div>
            )}

            <form onSubmit={handleSendFriendRequest} className="space-y-3">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-400 font-semibold">
                  @
                </span>
                <input
                  type="text"
                  placeholder="ex: lander ou lucas_cyber"
                  value={addUsernameInput}
                  onChange={(e) => setAddUsernameInput(e.target.value)}
                  className="w-full pl-8 pr-32 py-3 rounded-xl bg-white/[0.03] border border-white/15 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/40 shadow-inner"
                  required
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <LuneButton
                    type="submit"
                    variant="chrome"
                    size="sm"
                    loading={addLoading}
                    disabled={!addUsernameInput.trim()}
                  >
                    Enviar Pedido
                  </LuneButton>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Seu identificador público para que outros adicionem você:{' '}
                <strong className="text-white font-mono">@{currentUser.username}</strong>
              </p>
            </form>

            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
              <span className="text-xs font-semibold text-slate-200">
                Como funciona a rede privada LUNE?
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                O LUNE não possui servidores públicos de busca de usuários e não lista você publicamente. Somente amigos autorizados que possuam seu @username podem interagir, trocar arquivos e iniciar chamadas criptografadas com você.
              </p>
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
                        className="p-2 rounded-xl bg-white/15 hover:bg-white text-white hover:text-black transition shadow-sm"
                        title="Aceitar Pedido"
                      >
                        <Check className="w-4 h-4" />
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
              <div className="py-16 text-center text-xs text-slate-400 border border-white/5 rounded-2xl">
                {activeTab === 'ONLINE'
                  ? 'Nenhum amigo online agora. Que tal enviar um convite?'
                  : 'Nenhum amigo encontrado com essa busca.'}
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
