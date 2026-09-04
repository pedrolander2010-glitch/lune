import React, { useRef } from 'react';
import {
  FolderSync,
  UploadCloud,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  HardDrive
} from 'lucide-react';
import { SharedFile, UserInfo } from '../types';

interface FileTransferPanelProps {
  isOpen: boolean;
  onClose: () => void;
  files: SharedFile[];
  currentUser: UserInfo;
  onSendFile: (file: File) => void;
}

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const FileTransferPanel: React.FC<FileTransferPanelProps> = ({
  isOpen,
  onClose,
  files,
  currentUser,
  onSendFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendFile(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onSendFile(file);
    }
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-[#0a0a0e]/95 sm:bg-[#0c0d15]/95 border-l border-white/10 backdrop-blur-2xl shadow-2xl flex flex-col transition-all">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-400 shadow-sm">
            <FolderSync className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Arquivos P2P</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Canal Direto E2EE</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Upload Drop Zone */}
      <div className="p-4 border-b border-white/5">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 hover:border-indigo-400/50 rounded-2xl p-4 text-center cursor-pointer bg-white/5 hover:bg-white/[0.08] backdrop-blur-md transition group"
        >
          <UploadCloud className="w-8 h-8 mx-auto text-slate-400 group-hover:text-indigo-400 transition" />
          <div className="mt-2 text-xs font-semibold text-white">
            Clique ou arraste um arquivo aqui
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Vídeos, documentos, capturas e ZIPs enviados direto aos amigos
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-3 p-6">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 shadow-inner">
              <HardDrive className="w-6 h-6 text-indigo-400/80" />
            </div>
            <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
              Nenhum arquivo transferido nesta sessão.<br />
              Os arquivos são transmitidos em blocos cifrados via WebRTC DataChannel.
            </p>
          </div>
        ) : (
          files.map((file) => {
            const isMe = file.sender.id === currentUser.id;
            return (
              <div
                key={file.id}
                className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2.5 hover:bg-white/[0.08] backdrop-blur-md transition shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate">
                        {file.name}
                      </h4>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        <span>{isMe ? 'Enviado por você' : (file.sender?.name || file.senderName || 'Participante')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action or state */}
                  {file.status === 'completed' && file.dataUrl && (
                    <a
                      href={file.dataUrl}
                      download={file.name}
                      className="p-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs transition active:scale-95 shadow-sm shadow-indigo-500/25"
                      title="Baixar arquivo"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}

                  {file.status === 'completed' && !file.dataUrl && (
                    <span className="p-1.5 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  )}

                  {file.status === 'error' && (
                    <span className="p-1.5 text-red-400" title="Erro no envio">
                      <AlertCircle className="w-4 h-4" />
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {file.status === 'transferring' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-indigo-300 font-mono">
                      <span>Transmitindo...</span>
                      <span>{file.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-200"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
