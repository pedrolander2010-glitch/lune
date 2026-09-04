import React, { useState, useEffect } from 'react';
import { LuneModal } from './LuneModal';
import { LuneButton } from './LuneButton';
import { Smartphone, Monitor, Globe, ShieldAlert, LogOut, CheckCircle, RefreshCw } from 'lucide-react';
import { LuneSession } from '../../types';

export interface SessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoggedOutCurrent?: () => void;
}

export const SessionsModal: React.FC<SessionsModalProps> = ({
  isOpen,
  onClose,
  onLoggedOutCurrent,
}) => {
  const [sessions, setSessions] = useState<LuneSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const token = localStorage.getItem('lune_session_token');

  const fetchSessions = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSessions(data.sessions || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const handleRevokeOthers = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/auth/sessions/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ revokeOthers: true }),
      });
      if (res.ok) {
        setMsg('Todas as outras sessões foram desconectadas.');
        fetchSessions();
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeSingle = async (sessionId: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/sessions/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetSessionId: sessionId }),
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch {
      // ignore
    }
  };

  const getDeviceIcon = (platform: string, browser?: string) => {
    if (platform === 'mobile' || /android|iphone|ipad/i.test(browser || '')) {
      return <Smartphone className="w-5 h-5 text-slate-300" />;
    }
    if (platform === 'desktop') {
      return <Monitor className="w-5 h-5 text-slate-300" />;
    }
    return <Globe className="w-5 h-5 text-slate-300" />;
  };

  return (
    <LuneModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Dispositivos & Sessões Ativas"
      description="Monitore aparelhos conectados ao seu perfil LUNE e encerre acessos suspeitos."
      icon={<ShieldAlert className="w-6 h-6 text-slate-200" />}
    >
      <div className="space-y-4 text-left">
        {msg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{msg}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {sessions.length} {sessions.length === 1 ? 'dispositivo ativo' : 'dispositivos ativos'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchSessions}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            {sessions.filter((s) => !s.isCurrent).length > 0 && (
              <LuneButton
                type="button"
                variant="obsidian"
                size="sm"
                loading={actionLoading}
                onClick={handleRevokeOthers}
              >
                <LogOut className="w-3.5 h-3.5 mr-1 text-red-400" /> Desconectar Outros
              </LuneButton>
            )}
          </div>
        </div>

        {loading && sessions.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">Consultando sessões ativas...</div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                  s.isCurrent
                    ? 'bg-white/[0.04] border-white/20 shadow-sm'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/[0.05] border border-white/10">
                    {getDeviceIcon(s.platform, s.browser)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-200">
                        {s.deviceName || 'Navegador Web'}
                      </span>
                      {s.isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                          Este Dispositivo
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 space-x-2">
                      <span>{s.browser}</span>
                      <span>•</span>
                      <span>IP: {s.ip || 'Local'}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Última atividade: {new Date(s.lastActiveAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {!s.isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleRevokeSingle(s.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition text-xs"
                    title="Desconectar este dispositivo"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 border-t border-white/10 flex justify-end">
          <LuneButton type="button" variant="ghost" onClick={onClose}>
            Concluir
          </LuneButton>
        </div>
      </div>
    </LuneModal>
  );
};
