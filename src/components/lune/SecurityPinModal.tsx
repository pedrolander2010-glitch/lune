import React, { useState, useEffect } from 'react';
import { LuneModal } from './LuneModal';
import { LuneInput } from './LuneInput';
import { LuneButton } from './LuneButton';
import { KeyRound, ShieldAlert, History, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { LuneUser } from '../../types';

export interface SecurityPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: LuneUser;
  onUserUpdated: (updatedUser: Partial<LuneUser>) => void;
  initialAction?: 'CHANGE_NAME' | 'SETUP_PIN' | 'AUDIT_LOGS';
}

export const SecurityPinModal: React.FC<SecurityPinModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  initialAction = 'CHANGE_NAME',
}) => {
  const [tab, setTab] = useState<'NAME' | 'PIN' | 'AUDIT'>(
    initialAction === 'SETUP_PIN' ? 'PIN' : initialAction === 'AUDIT_LOGS' ? 'AUDIT' : 'NAME'
  );

  // Name change states
  const [newDisplayName, setNewDisplayName] = useState(currentUser.displayName);
  const [securityPinForName, setSecurityPinForName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameLoading, setNameLoading] = useState(false);

  // PIN setup states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  // Audit logs states
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const token = localStorage.getItem('lune_session_token');

  const fetchAuditLogs = async () => {
    if (!token) return;
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/user/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen && tab === 'AUDIT') {
      fetchAuditLogs();
    }
  }, [isOpen, tab]);

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(null);
    setNameLoading(true);

    try {
      const res = await fetch('/api/user/display-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newDisplayName,
          securityPin: securityPinForName || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setNameError(data.message || 'Erro ao alterar nome de exibição.');
        setNameLoading(false);
        return;
      }

      setNameSuccess('Nome de exibição atualizado com sucesso!');
      onUserUpdated({
        displayName: data.displayName,
        lastDisplayNameChangeAt: data.lastDisplayNameChangeAt,
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch {
      setNameError('Erro de conexão ao atualizar nome.');
    } finally {
      setNameLoading(false);
    }
  };

  const handleConfigurePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    if (newPin !== confirmPin) {
      setPinError('Os dígitos do PIN não coincidem.');
      return;
    }

    if (newPin.length < 4 || newPin.length > 8) {
      setPinError('O PIN deve conter entre 4 e 8 dígitos numéricos.');
      return;
    }

    setPinLoading(true);
    try {
      const res = await fetch('/api/user/security-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPinError(data.message || 'Falha ao configurar Security PIN.');
        setPinLoading(false);
        return;
      }

      setPinSuccess('Security PIN configurado com sucesso!');
      onUserUpdated({ hasSecurityPin: true });
      setCurrentPassword('');
      setNewPin('');
      setConfirmPin('');
    } catch {
      setPinError('Erro ao comunicar com o servidor.');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <LuneModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title="Segurança & Identidade"
      description="Gerenciamento de nome, Security PIN (bypass de 7 dias) e auditoria."
      icon={<ShieldAlert className="w-6 h-6 text-slate-200" />}
    >
      {/* Navigation Sub-Tabs */}
      <div className="flex p-1 mb-5 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
        <button
          type="button"
          onClick={() => setTab('NAME')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition ${
            tab === 'NAME' ? 'bg-white/15 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Nome de Exibição
        </button>
        <button
          type="button"
          onClick={() => setTab('PIN')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition ${
            tab === 'PIN' ? 'bg-white/15 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Security PIN
        </button>
        <button
          type="button"
          onClick={() => setTab('AUDIT')}
          className={`flex-1 py-1.5 px-3 rounded-lg font-medium transition ${
            tab === 'AUDIT' ? 'bg-white/15 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Logs de Auditoria
        </button>
      </div>

      {/* Tab: Change Display Name */}
      {tab === 'NAME' && (
        <form onSubmit={handleUpdateDisplayName} className="space-y-4 text-left">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-slate-300" />
              Política de Cooldown de 7 Dias
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Para preservar a clareza e prevenir personificação entre amigos, nomes só podem ser alterados a cada 7 dias, a menos que você forneça seu Security PIN para confirmação imediata.
            </p>
          </div>

          {nameError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{nameError}</span>
            </div>
          )}

          {nameSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{nameSuccess}</span>
            </div>
          )}

          <LuneInput
            label="Novo Nome de Exibição"
            placeholder="ex: Pedro Lander 🐈‍⬛"
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            required
          />

          <LuneInput
            label="Security PIN (Obrigatório se dentro de 7 dias)"
            type="password"
            placeholder="Digite seu PIN numérico (4-8 dígitos)"
            value={securityPinForName}
            onChange={(e) => setSecurityPinForName(e.target.value)}
            helperText={
              currentUser.hasSecurityPin
                ? 'PIN configurado detectado. Preencha para bypass imediato do cooldown.'
                : 'Você ainda não configurou um Security PIN. Configure na aba ao lado.'
            }
            leftIcon={<KeyRound className="w-4 h-4" />}
          />

          <div className="flex justify-end gap-2 pt-2">
            <LuneButton type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </LuneButton>
            <LuneButton type="submit" variant="chrome" loading={nameLoading}>
              Confirmar Alteração
            </LuneButton>
          </div>
        </form>
      )}

      {/* Tab: Security PIN Config */}
      {tab === 'PIN' && (
        <form onSubmit={handleConfigurePin} className="space-y-4 text-left">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-300" />
              PIN de Resguardo Crítico
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              O Security PIN é criptografado usando scrypt e permite alterar identificadores críticos, revogar sessões remotas e verificar ações sensíveis.
            </p>
          </div>

          {pinError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{pinError}</span>
            </div>
          )}

          {pinSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{pinSuccess}</span>
            </div>
          )}

          <LuneInput
            label="Senha da Conta Atual"
            type="password"
            placeholder="••••••••"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LuneInput
              label="Novo Security PIN"
              type="password"
              placeholder="ex: 7777"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              helperText="4 a 8 dígitos numéricos"
              required
            />
            <LuneInput
              label="Confirmar Security PIN"
              type="password"
              placeholder="ex: 7777"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <LuneButton type="button" variant="ghost" onClick={onClose}>
              Fechar
            </LuneButton>
            <LuneButton type="submit" variant="chrome" loading={pinLoading}>
              Salvar Security PIN
            </LuneButton>
          </div>
        </form>
      )}

      {/* Tab: Audit Logs */}
      {tab === 'AUDIT' && (
        <div className="space-y-3 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Histórico de ações da sua conta</span>
            <button
              type="button"
              onClick={fetchAuditLogs}
              className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1"
            >
              <History className="w-3 h-3" /> Atualizar
            </button>
          </div>

          {loadingLogs ? (
            <div className="py-8 text-center text-xs text-slate-400">Carregando logs de auditoria...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 border border-white/5 rounded-xl">
              Nenhuma ação crítica registrada até o momento.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-white/[0.02] border border-white/10 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 uppercase text-[10px] tracking-wider px-2 py-0.5 rounded bg-white/10">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px]">{log.details}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </LuneModal>
  );
};
