import React, { useState } from 'react';
import { LuneModal } from './LuneModal';
import { LuneInput } from './LuneInput';
import { LuneButton } from './LuneButton';
import { Lock, Mail, User, KeyRound, Sparkles, LogIn, UserPlus } from 'lucide-react';
import { LuneUser } from '../../types';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: LuneUser, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: loginInput, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Falha ao autenticar.');
        setLoading(false);
        return;
      }

      localStorage.setItem('lune_session_token', data.token);
      onSuccess(data.user, data.token);
      onClose();
    } catch {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          username,
          email,
          password,
          avatar: '/logo.svg',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Falha ao registrar conta.');
        setLoading(false);
        return;
      }

      localStorage.setItem('lune_session_token', data.token);
      onSuccess(data.user, data.token);
      onClose();
    } catch {
      setError('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (userLogin: string, pass: string) => {
    setLoginInput(userLogin);
    setPassword(pass);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: userLogin, password: pass }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('lune_session_token', data.token);
        onSuccess(data.user, data.token);
        onClose();
      } else {
        setError(data.message || 'Erro ao entrar.');
      }
    } catch {
      setError('Falha na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LuneModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title={
        mode === 'LOGIN'
          ? 'Entrar no LUNE'
          : mode === 'REGISTER'
          ? 'Criar Conta LUNE'
          : 'Recuperar Senha'
      }
      description={
        mode === 'LOGIN'
          ? 'Conecte-se à sua conta para conversar com amigos'
          : mode === 'REGISTER'
          ? 'Escolha seu @username único e entre na plataforma'
          : 'Instruções para redefinir suas credenciais'
      }
      icon={<img src="/logo.svg" alt="LUNE" className="w-6 h-6 object-contain" />}
    >
      {error && (
        <div className="p-3 mb-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 mb-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
          {successMsg}
        </div>
      )}

      {mode === 'LOGIN' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <LuneInput
            label="E-mail ou @username"
            placeholder="ex: @lander ou pedro@lune.chat"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <LuneInput
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
          />

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setMode('FORGOT')}
              className="text-slate-400 hover:text-white transition"
            >
              Esqueceu sua senha?
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('REGISTER');
                setError(null);
              }}
              className="text-slate-300 hover:text-white font-semibold underline underline-offset-4"
            >
              Criar conta nova
            </button>
          </div>

          <LuneButton type="submit" variant="chrome" loading={loading} className="w-full py-3">
            <LogIn className="w-4 h-4 mr-1" />
            Entrar no LUNE
          </LuneButton>

          {/* Quick Demo Credentials */}
          <div className="pt-3 border-t border-white/10 space-y-2 text-left">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Acesso Rápido de Demonstração:
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('lander', 'lander123')}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                @lander (Admin)
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('lune_cat', 'lander123')}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                @lune_cat (Bot)
              </button>
            </div>
          </div>
        </form>
      )}

      {mode === 'REGISTER' && (
        <form onSubmit={handleRegister} className="space-y-3.5">
          <LuneInput
            label="Nome de Exibição"
            placeholder="Seu Nome Completo ou Apelido"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            leftIcon={<Sparkles className="w-4 h-4" />}
            required
          />

          <LuneInput
            label="Username Único (@username)"
            placeholder="lander"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            leftIcon={<span className="text-sm font-bold text-slate-400">@</span>}
            helperText="Único e case-insensitive (ex: @lander e @Lander são idênticos)."
            required
          />

          <LuneInput
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LuneInput
              label="Senha"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />
            <LuneInput
              label="Confirmar Senha"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<KeyRound className="w-4 h-4" />}
              required
            />
          </div>

          <div className="flex justify-end text-xs pt-1">
            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setError(null);
              }}
              className="text-slate-400 hover:text-white transition"
            >
              Já possui conta? <span className="font-semibold text-white underline">Fazer Login</span>
            </button>
          </div>

          <LuneButton type="submit" variant="chrome" loading={loading} className="w-full py-3">
            <UserPlus className="w-4 h-4 mr-1" />
            Cadastrar no LUNE
          </LuneButton>
        </form>
      )}

      {mode === 'FORGOT' && (
        <div className="space-y-4 text-left">
          <p className="text-xs text-slate-300 leading-relaxed">
            Como o LUNE é uma rede privada para amigos, você pode redefinir sua senha diretamente com seu administrador local ou utilizando seu Security PIN configurado.
          </p>
          <LuneInput
            label="Seu E-mail Cadastrado"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
          />
          <LuneButton
            type="button"
            variant="obsidian"
            className="w-full"
            onClick={() => {
              setSuccessMsg('Solicitação registrada. Solicite aprovação ao administrador do LUNE.');
              setTimeout(() => setMode('LOGIN'), 2500);
            }}
          >
            Solicitar Redefinição
          </LuneButton>
          <button
            type="button"
            onClick={() => setMode('LOGIN')}
            className="text-xs text-slate-400 hover:text-white transition block text-center w-full"
          >
            Voltar para Login
          </button>
        </div>
      )}
    </LuneModal>
  );
};
