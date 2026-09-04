import React from 'react';
import { Settings, Sliders, Moon, Sun, Bell, Volume2, ShieldCheck, Zap, X, Mic } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onRequestPushPermission: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onRequestPushPermission,
}) => {
  if (!isOpen) return null;

  const handleTogglePush = async () => {
    if (!settings.pushNotificationsEnabled) {
      await onRequestPushPermission();
    } else {
      onUpdateSettings({ pushNotificationsEnabled: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-[28px] sm:rounded-[32px] bg-[#0c0d15]/95 border border-white/10 p-6 shadow-2xl backdrop-blur-2xl text-slate-100 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-400 shadow-inner">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Configurações do App</h3>
            <p className="text-xs text-slate-400">Taxa de quadros, privacidade e preferências</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Framerate Selection (30 vs 60 FPS) */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Taxa de Quadros (FPS Nativo)
              </span>
              <span className="text-xs font-bold text-indigo-400">
                {settings.preferredFps} FPS
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateSettings({ preferredFps: 30 })}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition flex flex-col items-center gap-1 ${
                  settings.preferredFps === 30
                    ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 ring-1 ring-indigo-400/30'
                    : 'bg-white/[0.02] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>30 FPS</span>
                <span className="text-[10px] font-normal opacity-75">Economia de banda</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ preferredFps: 60 })}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition flex flex-col items-center gap-1 ${
                  settings.preferredFps === 60
                    ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 ring-1 ring-indigo-400/30'
                    : 'bg-white/[0.02] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>60 FPS Nativo</span>
                <span className="text-[10px] font-normal opacity-75">Máxima fluidez</span>
              </button>
            </div>
          </div>

          {/* Resolution */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Resolução de Transmissão
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['1080p', '720p', '480p'] as const).map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => onUpdateSettings({ preferredResolution: res })}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border transition ${
                    settings.preferredResolution === res
                      ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 ring-1 ring-indigo-400/30'
                      : 'bg-white/[0.02] border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Filters */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
              Filtros de Áudio de Microfone
            </span>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Cancelamento de Eco</span>
              <input
                type="checkbox"
                checked={settings.echoCancellation}
                onChange={(e) => onUpdateSettings({ echoCancellation: e.target.checked })}
                className="w-4 h-4 rounded accent-indigo-500"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Supressão de Ruído de Fundo</span>
              <input
                type="checkbox"
                checked={settings.noiseSuppression}
                onChange={(e) => onUpdateSettings({ noiseSuppression: e.target.checked })}
                className="w-4 h-4 rounded accent-indigo-500"
              />
            </div>
          </div>

          {/* Notifications & Sound */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-indigo-400" />
              Notificações e Alertas Sonoros
            </span>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Notificações Push no Navegador</span>
              <button
                type="button"
                onClick={handleTogglePush}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                  settings.pushNotificationsEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/15'
                }`}
              >
                {settings.pushNotificationsEnabled ? 'Ativado' : 'Ativar'}
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Alertas Sonoros (Toque & Pop de Chat)</span>
              <input
                type="checkbox"
                checked={settings.soundAlertsEnabled}
                onChange={(e) => onUpdateSettings({ soundAlertsEnabled: e.target.checked })}
                className="w-4 h-4 rounded accent-indigo-500"
              />
            </div>

            {settings.soundAlertsEnabled && (
              <div className="pt-1 space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Volume dos Alertas
                  </span>
                  <span>{Math.round(settings.soundVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.soundVolume}
                  onChange={(e) => onUpdateSettings({ soundVolume: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Theme Mode */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {settings.darkMode ? (
                <Moon className="w-4 h-4 text-indigo-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
              <span className="text-xs font-medium text-slate-300">Tema Visual</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ darkMode: !settings.darkMode })}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition flex items-center gap-1.5 border border-white/5"
            >
              {settings.darkMode ? 'Modo Escuro (Frosted)' : 'Modo Claro'}
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-xs font-semibold text-white transition shadow-md shadow-indigo-500/30 border border-indigo-400/30"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
