import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../utils/pwa';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {isInstallable && (
        <button
          onClick={install}
          id="pwa-install-btn"
          className="flex items-center gap-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-all shadow-sm active:scale-95"
          title="Instalar aplicativo no PC ou celular"
        >
          <Download className="w-3.5 h-3.5" />
          {!compact && <span>Instalar App</span>}
        </button>
      )}

      {isIOS && (
        <button
          onClick={() => setShowIOSGuide(true)}
          id="pwa-ios-guide-btn"
          className="flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-md transition-all active:scale-95"
          title="Instalar no iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5" />
          {!compact && <span>Instalar no iOS</span>}
        </button>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900/90 border border-white/15 p-6 shadow-2xl text-slate-100 relative">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              Instalar no iPhone ou iPad
            </h3>
            <div className="mt-3 text-sm text-slate-300 space-y-2">
              <p>
                1. Toque no botão <strong>Compartilhar</strong> (ícone com seta para cima) na barra inferior do Safari.
              </p>
              <p>
                2. Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.
              </p>
              <p>
                3. Toque em <strong>Adicionar</strong> no canto superior direito para desfrutar da experiência em tela cheia com 60 FPS!
              </p>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 py-2.5 text-sm font-medium text-white transition-all shadow-md"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
