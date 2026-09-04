import React, { useState, useRef, useEffect } from 'react';
import { Send, Lock, X, Paperclip, Smile, ShieldCheck } from 'lucide-react';
import { ChatMessage, UserInfo } from '../types';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentUser: UserInfo;
  onSendMessage: (text: string) => void;
  onSendFile: (file: File) => void;
}

const QUICK_EMOJIS = ['👍', '🔥', '😂', '👏', '❤️', '🚀', '👀'];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  currentUser,
  onSendMessage,
  onSendFile,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

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
    <aside
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-[#0a0a0e]/95 sm:bg-[#0c0d15]/95 border-l border-white/10 backdrop-blur-2xl shadow-2xl flex flex-col transition-all"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center text-indigo-400 shadow-sm">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Chat Privado E2EE</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>AES-256 Criptografado</span>
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

      {/* Messages list */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-3 p-6">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400 shadow-inner">
              <Lock className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
              Nenhuma mensagem ainda.<br />
              Todas as mensagens transmitidas são cifradas de ponta a ponta com a chave da sala.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = (msg.sender?.id || msg.senderId) === currentUser?.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col space-y-1 ${isMe ? 'items-end' : 'items-start'}`}
              >
                <p className={`text-[10px] font-bold uppercase tracking-wider px-1 ${
                  isMe ? 'text-slate-400' : 'text-indigo-400'
                }`}>
                  {isMe ? 'Você' : (msg.sender?.name || msg.senderName || 'Participante')} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>

                <div
                  className={`max-w-[85%] p-3 text-xs leading-relaxed shadow-md ${
                    isMe
                      ? 'bg-indigo-500/15 border border-indigo-500/25 text-slate-100 rounded-2xl rounded-tr-none'
                      : 'bg-white/5 border border-white/5 text-slate-200 rounded-2xl rounded-tl-none'
                  }`}
                >
                  <p className="break-words">{msg.decryptedText}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick emoji reaction bar */}
      {showEmojis && (
        <div className="px-4 py-2 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto bg-white/[0.02]">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setInputText((prev) => prev + emoji);
                setShowEmojis(false);
              }}
              className="p-1.5 text-base hover:bg-white/10 rounded-xl transition active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Message input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/5 bg-white/[0.02] flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/5 transition"
          title="Compartilhar arquivo P2P"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setShowEmojis(!showEmojis)}
          className="p-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/5 transition"
          title="Inserir emoji"
        >
          <Smile className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Mensagem cifrada..."
          className="flex-1 px-3.5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/30"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white transition active:scale-95 shadow-md shadow-indigo-500/30 border border-indigo-400/30"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  );
};
