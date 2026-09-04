import React, { useState } from 'react';
import { UserPlus, Users, Copy, Check, X, PhoneCall, Trash2, Shield, CircleDot, UserCheck } from 'lucide-react';
import { UserInfo, Friend, FriendRequest } from '../types';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserInfo;
  friends: Friend[];
  pendingRequests: FriendRequest[];
  onSendFriendRequest: (targetTag: string) => void;
  onAcceptRequest: (req: FriendRequest) => void;
  onDeclineRequest: (reqId: string) => void;
  onRemoveFriend: (tag: string) => void;
  onCallFriend: (friendTag: string) => void;
  onUpdateProfile: (name: string, color: string) => void;
}

const AVATAR_COLORS = [
  '#0ea5e9', '#06b6d4', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#6366f1'
];

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  friends,
  pendingRequests,
  onSendFriendRequest,
  onAcceptRequest,
  onDeclineRequest,
  onRemoveFriend,
  onCallFriend,
  onUpdateProfile,
}) => {
  const [tagInput, setTagInput] = useState('');
  const [copiedTag, setCopiedTag] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'profile'>('friends');
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profileColor, setProfileColor] = useState(currentUser.avatarColor);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopyTag = () => {
    navigator.clipboard.writeText(currentUser.tag);
    setCopiedTag(true);
    setTimeout(() => setCopiedTag(false), 2000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim()) return;
    onSendFriendRequest(tagInput.trim());
    setTagInput('');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;
    onUpdateProfile(profileName.trim(), profileColor);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-[28px] sm:rounded-[32px] bg-[#0c0d15]/95 border border-white/10 p-6 shadow-2xl backdrop-blur-2xl text-slate-100 relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-400 shadow-inner">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Amigos & Conexões</h3>
            <p className="text-xs text-slate-400">Conecte-se para chamadas instantâneas com 2-3 amigos</p>
          </div>
        </div>

        {/* Current user tag chip */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-md"
              style={{ backgroundColor: currentUser.avatarColor }}
            >
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xs text-slate-400">Sua Tag Pessoal</div>
              <div className="text-sm font-mono font-semibold text-indigo-300">{currentUser.tag}</div>
            </div>
          </div>
          <button
            onClick={handleCopyTag}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white transition active:scale-95 border border-white/5"
          >
            {copiedTag ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedTag ? 'Copiada' : 'Copiar'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-4">
          <button
            onClick={() => setActiveTab('friends')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition ${
              activeTab === 'friends'
                ? 'border-indigo-400 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Amigos ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition relative ${
              activeTab === 'pending'
                ? 'border-indigo-400 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Solicitações
            {pendingRequests.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-indigo-500 text-white font-bold text-[10px]">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition ${
              activeTab === 'profile'
                ? 'border-indigo-400 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Meu Perfil
          </button>
        </div>

        {/* Tab contents */}
        <div className="flex-1 overflow-y-auto min-h-[220px]">
          {activeTab === 'friends' && (
            <div className="space-y-4">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tag do amigo (ex: joao#1234)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-mono"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition active:scale-95 shrink-0 shadow-md shadow-indigo-500/25 border border-indigo-400/30"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </form>

              <div className="space-y-2">
                {friends.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Nenhum amigo adicionado ainda.<br />
                    Compartilhe sua tag ou adicione amigos para ligar com 1 clique!
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.tag}
                      className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between hover:bg-white/[0.08] transition shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold relative shadow"
                          style={{ backgroundColor: friend.avatarColor }}
                        >
                          {friend.name.charAt(0).toUpperCase()}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0c0d15] ${
                              friend.status === 'online'
                                ? 'bg-emerald-400'
                                : friend.status === 'in-call'
                                ? 'bg-amber-400'
                                : 'bg-slate-500'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white">{friend.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{friend.tag}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onCallFriend(friend.tag)}
                          className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition"
                          title="Ligar para amigo"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRemoveFriend(friend.tag)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                          title="Remover amigo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="space-y-2">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhuma solicitação de amizade pendente.
                </div>
              ) : (
                pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: req.fromUser.avatarColor }}
                      >
                        {req.fromUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">{req.fromUser.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{req.fromUser.tag}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onAcceptRequest(req)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition flex items-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Aceitar
                      </button>
                      <button
                        onClick={() => onDeclineRequest(req.id)}
                        className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 text-xs transition"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Seu Nome de Exibição
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-400"
                  maxLength={32}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Cor do Avatar
                </label>
                <div className="flex gap-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setProfileColor(color)}
                      className={`w-7 h-7 rounded-full transition transform active:scale-95 ${
                        profileColor === color ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white text-xs font-semibold transition active:scale-95 shadow-md shadow-indigo-500/25 border border-indigo-400/30"
                >
                  {savedSuccess ? 'Perfil Salvo!' : 'Salvar Perfil'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
