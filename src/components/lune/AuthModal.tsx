import React, { useState } from 'react';
import { LuneModal } from './LuneModal';
import { LuneInput } from './LuneInput';
import { LuneButton } from './LuneButton';
import { Lock, Mail, User, KeyRound, Sparkles, LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { LuneUser } from '../../types';
import { LUNE_LOGO_URL } from '../../utils/assets';
import {
  supabase,
  isSupabaseConfigured,
  mapProfileToLuneUser,
  ProfileRow,
} from '../../lib/supabase';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: LuneUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured()) {
      setError('O backend remoto do Supabase não está configurado.');
      return;
    }

    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !password) {
      setError('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoading(true);

    try {
      // 1. Supabase Auth Sign In
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (authError || !data.user) {
        if (authError?.message?.includes('Invalid login credentials')) {
          setError('Credenciais inválidas. Verifique seu e-mail e senha.');
        } else if (authError?.message?.includes('Email not confirmed')) {
          setError('E-mail não confirmado. Verifique sua caixa de entrada.');
        } else {
          setError(authError?.message || 'Falha ao autenticar.');
        }
        setLoading(false);
        return;
      }

      // 2. Fetch User Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        // Create initial profile if trigger did not fire
        const fallbackUsername = cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '');
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username: fallbackUsername,
            username_normalized: fallbackUsername,
            display_name: fallbackUsername,
            avatar_url: LUNE_LOGO_URL,
            presence_status: 'ONLINE',
          })
          .select('*')
          .single();

        if (newProfile) {
          onSuccess(mapProfileToLuneUser(newProfile as ProfileRow, data.user.email));
          onClose();
        } else {
          setError('Perfil de usuário não encontrado.');
        }
      } else {
        onSuccess(mapProfileToLuneUser(profileData as ProfileRow, data.user.email));
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured()) {
      setError('O backend remoto do Supabase não está configurado.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    const cleanDisplay = displayName.trim();
    const cleanEmail = emailInput.trim();

    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 24) {
      setError('O @username deve ter entre 3 e 24 caracteres.');
      return;
    }

    if (!/^[a-zA-Z0-9_.]+$/.test(cleanUsername)) {
      setError('O @username pode conter apenas letras, números, ponto (.) e underline (_).');
      return;
    }

    if (!cleanDisplay || cleanDisplay.length > 32) {
      setError('O nome de exibição deve ter entre 1 e 32 caracteres.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);

    try {
      // 1. Check if username is already taken in PostgreSQL
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username_normalized', cleanUsername)
        .maybeSingle();

      if (existingUser) {
        setError(`O @username "${cleanUsername}" já está em uso por outro usuário.`);
        setLoading(false);
        return;
      }

      // 2. Supabase Auth Sign Up
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            username: cleanUsername,
            display_name: cleanDisplay,
            avatar_url: LUNE_LOGO_URL,
          },
        },
      });

      if (signUpError || !data.user) {
        setError(signUpError?.message || 'Falha ao registrar conta no Supabase.');
        setLoading(false);
        return;
      }

      // 3. Upsert Profile Row to guarantee consistency
      const { data: profile, error: insertError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          username: cleanUsername,
          username_normalized: cleanUsername,
          display_name: cleanDisplay,
          avatar_url: LUNE_LOGO_URL,
          presence_status: 'ONLINE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (insertError) {
        console.warn('Profile creation warning:', insertError);
      }

      if (profile) {
        onSuccess(mapProfileToLuneUser(profile as ProfileRow, data.user.email));
      } else {
        onSuccess({
          id: data.user.id,
          username: cleanUsername,
          displayName: cleanDisplay,
          email: cleanEmail,
          avatar: LUNE_LOGO_URL,
          presence: 'ONLINE',
          role: 'USER',
          createdAt: new Date().toISOString(),
        });
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      setError('Informe seu e-mail cadastrado.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin + window.location.pathname,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setSuccessMsg('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao solicitar recuperação.');
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
          ? 'Conecte-se com sua conta para conversar com amigos'
          : mode === 'REGISTER'
          ? 'Crie seu perfil com @username único persistido em nuvem'
          : 'Enviaremos instruções de redefinição para seu e-mail'
      }
      icon={<img src={LUNE_LOGO_URL} alt="LUNE" className="w-6 h-6 object-contain" />}
    >
      {error && (
        <div className="p-3 mb-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium text-left">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 mb-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium text-left">
          {successMsg}
        </div>
      )}

      {mode === 'LOGIN' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <LuneInput
            label="E-mail de Acesso"
            type="email"
            placeholder="seu@email.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
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
              onClick={() => {
                setMode('FORGOT');
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-slate-400 hover:text-white transition"
            >
              Esqueceu sua senha?
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('REGISTER');
                setError(null);
                setSuccessMsg(null);
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

          <div className="pt-2 text-center">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              Autenticação Segura via Supabase Auth
            </span>
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
            placeholder="ex: pedro ou carlos"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
            leftIcon={<span className="text-sm font-bold text-slate-400">@</span>}
            helperText="Único e case-insensitive (ex: @lander e @Lander são idênticos)."
            required
          />

          <LuneInput
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
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
                setSuccessMsg(null);
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
        <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
          <p className="text-xs text-slate-300 leading-relaxed">
            Informe o e-mail associado à sua conta LUNE. Enviaremos um link seguro para você redefinir sua senha.
          </p>
          <LuneInput
            label="Seu E-mail Cadastrado"
            type="email"
            placeholder="seu@email.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
          />
          <LuneButton
            type="submit"
            variant="obsidian"
            loading={loading}
            className="w-full py-2.5"
          >
            Enviar Link de Redefinição
          </LuneButton>
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setError(null);
              setSuccessMsg(null);
            }}
            className="text-xs text-slate-400 hover:text-white transition block text-center w-full"
          >
            Voltar para Login
          </button>
        </form>
      )}
    </LuneModal>
  );
};
