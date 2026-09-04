import React from 'react';
import { Database, ShieldAlert, Sparkles, Terminal, FileCode, CheckCircle2 } from 'lucide-react';
import { LUNE_LOGO_URL } from '../../utils/assets';

export const BackendConfigNotice: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#060609] text-slate-100 flex items-center justify-center p-4 selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="w-full max-w-xl rounded-3xl bg-[#0c0d15]/90 border border-white/15 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-black/80 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-white/10 pb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/20 p-2.5 flex items-center justify-center shadow-inner">
            <img src={LUNE_LOGO_URL} alt="LUNE" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">LUNE</h1>
              <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300">
                Setup Obrigatório
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Arquitetura Distribuída Multi-Usuário (Supabase Backend)
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-left">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-300 leading-relaxed">
            <p className="font-semibold text-amber-300">
              O backend remoto do Supabase não está configurado.
            </p>
            <p>
              Em conformidade com a arquitetura de produção do LUNE, bancos locais simulados, contas falsas e armazenamento em memória foram desativados.
              Para que usuários reais em computadores e redes distintas conversem, o Supabase é a fonte única da verdade.
            </p>
          </div>
        </div>

        {/* Required Variables */}
        <div className="space-y-2 text-left">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            Variáveis de Ambiente Necessárias (.env)
          </div>
          <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-slate-300 space-y-1.5 select-all overflow-x-auto">
            <p className="text-indigo-300">VITE_SUPABASE_URL="https://your-project.supabase.co"</p>
            <p className="text-emerald-300">VITE_SUPABASE_ANON_KEY="your-anon-public-key"</p>
          </div>
        </div>

        {/* Setup Steps */}
        <div className="space-y-2.5 text-left text-xs text-slate-300">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
            <FileCode className="w-3.5 h-3.5 text-purple-400" />
            Passos Rápidos de Inicialização
          </div>
          <ul className="space-y-2 pl-1">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Crie um projeto gratuito no <strong>Supabase</strong> (<a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">supabase.com</a>).</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Execute o arquivo de migração completo localizado em <strong>supabase/migrations/20260904000000_lune_init.sql</strong> no SQL Editor do Supabase.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Copie o <strong>Project URL</strong> e a chave pública <strong>anon key</strong> em Project Settings &gt; API e insira no arquivo <strong>.env</strong>.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>Consulte o manual detalhado em <strong>BACKEND_SETUP.md</strong> na raiz do repositório.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
