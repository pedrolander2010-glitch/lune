import React, { useState } from 'react';
import { MonitorPlay, Key, X, Sparkles, LogIn, Zap } from 'lucide-react';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (roomId: string, passKey?: string) => void;
  defaultFps: 30 | 60;
  onSetFps: (fps: 30 | 60) => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  onJoinRoom,
  defaultFps,
  onSetFps,
}) => {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [passKeyInput, setPassKeyInput] = useState('');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newRoomId = 'glass-' + Math.floor(1000 + Math.random() * 9000);
    onJoinRoom(newRoomId, passKeyInput.trim() || undefined);
    onClose();
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomIdInput.trim()) return;
    onJoinRoom(roomIdInput.trim(), passKeyInput.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-[28px] sm:rounded-[32px] bg-[#0c0d15]/95 border border-white/10 p-6 shadow-2xl backdrop-blur-2xl text-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-400 shadow-inner">
            <MonitorPlay className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Iniciar Transmissão</h3>
            <p className="text-xs text-slate-400">Transmissão P2P com até 60 FPS nativo</p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-2xl bg-white/5 p-1 border border-white/10 mb-5">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              mode === 'create'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Criar Nova Sala
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition ${
              mode === 'join'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Entrar com Código
          </button>
        </div>

        {/* Form */}
        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Taxa de Quadros da Sala
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSetFps(30)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition ${
                    defaultFps === 30
                      ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 ring-1 ring-indigo-400/30'
                      : 'border-white/10 text-slate-400 hover:text-white bg-white/[0.02]'
                  }`}
                >
                  30 FPS Padrão
                </button>
                <button
                  type="button"
                  onClick={() => onSetFps(60)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition ${
                    defaultFps === 60
                      ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 ring-1 ring-indigo-400/30'
                      : 'border-white/10 text-slate-400 hover:text-white bg-white/[0.02]'
                  }`}
                >
                  60 FPS Nativo
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                Senha Secreta E2EE (Opcional)
              </label>
              <input
                type="text"
                value={passKeyInput}
                onChange={(e) => setPassKeyInput(e.target.value)}
                placeholder="Senha de criptografia compartilhada com os amigos"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Se deixar em branco, será usada a chave padrão segura da sala.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-semibold text-xs transition shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 active:scale-95 border border-indigo-400/30"
              >
                <Sparkles className="w-4 h-4" />
                Criar Sala Instantânea
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Código da Sala
              </label>
              <input
                type="text"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                placeholder="Ex: glass-1234"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                Senha Secreta da Sala (se houver)
              </label>
              <input
                type="text"
                value={passKeyInput}
                onChange={(e) => setPassKeyInput(e.target.value)}
                placeholder="Senha E2EE combinada com o anfitrião"
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={!roomIdInput.trim()}
                className="w-full py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-semibold text-xs transition shadow-md shadow-indigo-500/30 flex items-center justify-center gap-2 active:scale-95 border border-indigo-400/30"
              >
                <LogIn className="w-4 h-4" />
                Entrar na Sala
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
