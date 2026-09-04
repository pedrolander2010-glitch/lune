import React, { useState } from 'react';
import { ShieldCheck, Lock, Key, Copy, Check, X, ShieldAlert, Cpu } from 'lucide-react';

interface SecurityBadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  fingerprint: string;
  roomKey: string;
  onUpdateRoomKey: (newKey: string) => void;
  roomId: string;
}

export const SecurityBadgeModal: React.FC<SecurityBadgeModalProps> = ({
  isOpen,
  onClose,
  fingerprint,
  roomKey,
  onUpdateRoomKey,
  roomId,
}) => {
  const [copied, setCopied] = useState(false);
  const [customKey, setCustomKey] = useState(roomKey);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveKey = () => {
    onUpdateRoomKey(customKey.trim() || 'default_glass_room_e2ee');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-[28px] sm:rounded-[32px] bg-[#0c0d15]/95 border border-white/10 p-6 shadow-2xl backdrop-blur-2xl text-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Criptografia de Ponta a Ponta</h2>
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Nível Máximo de Segurança Ativo
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4 text-sm text-slate-300">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-white font-medium">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Arquitetura de Privacidade P2P</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sua transmissão de tela, áudio e vídeo trafegam diretamente entre você e seus amigos via protocolo <strong>WebRTC DTLS-SRTP</strong>. Nenhum pixel ou áudio passa por servidores de gravação.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Código de Segurança (Fingerprint SHA-256)
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="font-mono text-xs p-3 rounded-xl bg-black/50 border border-white/10 text-indigo-300 tracking-wider text-center select-all">
              {fingerprint}
            </div>
            <p className="text-[11px] text-slate-400">
              Compare este código de segurança com seus amigos. Se os números forem idênticos, você tem garantia matemática contra interceptações.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              Chave Secreta da Sala (AES-GCM 256-bit)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="Digite ou personalize a senha secreta da sala"
                className="flex-1 px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 font-mono"
              />
              <button
                onClick={handleSaveKey}
                className="px-4 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-xs font-medium text-white transition active:scale-95 shadow-md shadow-indigo-500/25 border border-indigo-400/30"
              >
                Salvar
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Todas as mensagens do chat e chunks de arquivos são cifrados localmente com esta chave antes do envio.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition border border-white/10"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
