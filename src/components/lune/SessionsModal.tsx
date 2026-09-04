import React, { useState, useEffect } from 'react';
import { LuneModal } from './LuneModal';
import { LuneButton } from './LuneButton';
import { Smartphone, Monitor, Globe, ShieldAlert, LogOut, CheckCircle, RefreshCw } from 'lucide-react';
import { LuneSession } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

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

  const fetchSessions = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const isMobile = /mobile|iphone|ipad|android/i.test(navigator.userAgent);
        const currentSession: LuneSession = {
          id: data.session.access_token.slice(-16),
          userId: data.session.user.id,
          deviceName: navigator.userAgent.split(') ')[0]?.split('; ')[1] || 'Web Browser',
          platform: isMobile ? 'mobile' : 'desktop',
          browser: navigator.userAgent.split(') ')[0]?.split('; ')[1] || 'Web Browser',
          ip: 'Nuvem Supabase Auth',
          lastActiveAt: new Date().toISOString(),
          createdAt: data.session.user.created_at || new Date().toISOString(),
          isCurrent: true,
        };
        setSessions([currentSession]);
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
    if (!isSupabaseConfigured()) return;
    setActionLoading(true);
    try {
      await supabase.auth.signOut({ scope: 'others' });
      setMsg('Todas as outras sessões foram desconectadas na nuvem.');
      fetchSessions();
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeSingle = async (sessionId: string) => {
    if (onLoggedOutCurrent) {
      await supabase.auth.signOut();
      onLoggedOutCurrent();
      onClose();
    }
  };

  const getDeviceIcon = (platform: string) => {
    if (platform === 'mobile') {
      return <Smartphone className="w-5 h-5 text-slate-300" />;
    }
    return <Monitor className="w-5 h-5 text-slate-300" />;
  };

  return (
    <LuneModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Sessões Ativas (Supabase Auth)"
      description="Dispositivos conectados à sua conta na infraestrutura em nuvem."
      icon={<ShieldAlert className="w-6 h-6 text-slate-200" />}
    >
      <div className="space-y-4">
        {msg && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium text-left">
            {msg}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Sessão Atual ({sessions.length})
          </span>
          <button
            onClick={fetchSessions}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`p-3.5 rounded-2xl border transition text-left flex items-center justify-between gap-3 ${
                session.isCurrent
                  ? 'bg-white/[0.06] border-white/20'
                  : 'bg-white/[0.02] border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  {getDeviceIcon(session.platform)}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {session.browser}
                    </span>
                    {session.isCurrent && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                        Esta Sessão
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {session.ip} • Ativa agora
                  </div>
                </div>
              </div>

              {session.isCurrent ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <button
                  onClick={() => handleRevokeSingle(session.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                  title="Desconectar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="pt-2">
          <LuneButton
            variant="obsidian"
            size="sm"
            loading={actionLoading}
            onClick={handleRevokeOthers}
            className="w-full py-2.5 text-xs text-red-300 hover:text-red-200 border-red-500/20 hover:border-red-500/40"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            Desconectar de Todos os Outros Dispositivos
          </LuneButton>
        </div>
      </div>
    </LuneModal>
  );
};
