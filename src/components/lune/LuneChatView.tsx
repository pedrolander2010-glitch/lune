import React, { useState, useEffect, useRef } from 'react';
import { LuneAvatar } from './LuneAvatar';
import { LuneEmojiPicker } from './LuneEmojiPicker';
import { LuneGifPicker } from './LuneGifPicker';
import { LUNE_LOGO_URL } from '../../utils/assets';
import {
  Send,
  Smile,
  Image as ImageIcon,
  Paperclip,
  Phone,
  Video,
  Pin,
  MoreVertical,
  Reply,
  Trash2,
  Share2,
  X,
  FileText,
  ChevronLeft,
} from 'lucide-react';
import { LuneConversation, LuneMessage, LuneUser } from '../../types';

export interface LuneChatViewProps {
  conversation: LuneConversation;
  currentUser: LuneUser;
  onStartCall: (targetUserId: string, type: 'voice' | 'video') => void;
  onBackMobile?: () => void;
}

export const LuneChatView: React.FC<LuneChatViewProps> = ({
  conversation,
  currentUser,
  onStartCall,
  onBackMobile,
}) => {
  const [messages, setMessages] = useState<LuneMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [replyTarget, setReplyTarget] = useState<LuneMessage | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ url: string; filename: string; size: number } | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const token = localStorage.getItem('lune_session_token');

  // Other member in DM
  const otherMember = conversation.type === 'DM'
    ? conversation.members.find((m) => m.userId !== currentUser.id) || conversation.members[0]
    : null;

  const title = conversation.name || otherMember?.displayName || 'Conversa LUNE';
  const avatar = conversation.icon || otherMember?.avatar || LUNE_LOGO_URL;
  const subtitle = conversation.type === 'DM'
    ? `@${otherMember?.username || 'amigo'} • ${otherMember?.presence || 'OFFLINE'}`
    : `${conversation.members.length} membros`;

  const fetchMessages = async () => {
    if (!token || !conversation.id) return;
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3500);
    return () => clearInterval(interval);
  }, [conversation.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !attachedFile) || !token) return;

    const content = inputText.trim();
    setInputText('');
    const currentAttachment = attachedFile;
    setAttachedFile(null);
    const currentReply = replyTarget;
    setReplyTarget(null);

    try {
      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content,
          replyToId: currentReply?.id,
          attachments: currentAttachment ? [currentAttachment] : [],
        }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!token) return;
    try {
      await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emoji }),
      });
      fetchMessages();
    } catch {
      // ignore
    }
  };

  const handlePin = async (messageId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/messages/${messageId}/pin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMessages();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      // ignore
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAttachedFile({
        url: dataUrl,
        filename: file.name,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const pinnedMessages = messages.filter((m) => m.isPinned);

  return (
    <div className="flex flex-col h-full w-full bg-[#070709]/80 backdrop-blur-2xl relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-3.5 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBackMobile && (
            <button
              type="button"
              onClick={onBackMobile}
              className="md:hidden flex items-center justify-center w-10 h-10 -ml-1 rounded-xl bg-white/5 active:bg-white/20 text-slate-200 transition shrink-0"
              title="Voltar para conversas"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <LuneAvatar
            src={avatar}
            name={title}
            status={otherMember?.presence || 'ONLINE'}
            size="md"
          />
          <div className="text-left min-w-0">
            <h3 className="text-sm font-bold text-white leading-tight truncate">{title}</h3>
            <span className="text-[11px] text-slate-400 font-mono truncate block">{subtitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {otherMember && (
            <>
              <button
                type="button"
                onClick={() => onStartCall(otherMember.userId, 'voice')}
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-white/5 active:bg-white/20 hover:bg-white/15 text-slate-300 hover:text-white transition flex items-center justify-center"
                title="Chamada de Voz"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onStartCall(otherMember.userId, 'video')}
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-white/5 active:bg-white/20 hover:bg-white/15 text-slate-300 hover:text-white transition flex items-center justify-center"
                title="Chamada de Vídeo / Compartilhar Tela"
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pinned Messages Bar */}
      {pinnedMessages.length > 0 && (
        <div className="px-4 py-2 bg-white/[0.03] border-b border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-300 truncate">
            <Pin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="font-semibold text-white">Mensagem fixada:</span>
            <span className="truncate text-slate-400">{pinnedMessages[pinnedMessages.length - 1].content}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
            {pinnedMessages.length} {pinnedMessages.length === 1 ? 'fixada' : 'fixadas'}
          </span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-60">
            <img src={LUNE_LOGO_URL} alt="LUNE" className="w-12 h-12 object-contain" />
            <span className="text-xs text-slate-400">
              Início da conversa criptografada com {title}.
            </span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.authorId === currentUser.id;
            return (
              <div
                key={msg.id}
                className={`group flex items-start gap-3 text-left ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <LuneAvatar
                  src={msg.author?.avatar}
                  name={msg.author?.displayName || 'User'}
                  size="sm"
                  status={msg.author?.presence}
                />

                <div className={`max-w-md sm:max-w-lg space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Author Header */}
                  <div className={`flex items-center gap-2 text-[11px] ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className="font-bold text-slate-200">
                      {msg.author?.displayName || 'Usuário'}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.isPinned && <Pin className="w-3 h-3 text-slate-300" />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed break-words relative ${
                      isMe
                        ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                        : 'bg-white/[0.04] text-slate-200 border border-white/10'
                    }`}
                  >
                    {/* Content text */}
                    {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.attachments.map((att) => {
                          const isImage = att.url?.startsWith('data:image') || /\.(png|jpe?g|gif|webp)$/i.test(att.url);
                          return isImage ? (
                            <img
                              key={att.id || att.url}
                              src={att.url}
                              alt={att.filename}
                              className="max-h-60 rounded-xl border border-white/10 object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <a
                              key={att.id || att.url}
                              href={att.url}
                              download={att.filename}
                              className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/10 text-[11px] text-slate-200 hover:text-white"
                            >
                              <FileText className="w-4 h-4 text-slate-300" />
                              <span className="truncate">{att.filename}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {/* Quick hover reaction buttons */}
                    <div
                      className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 p-1 rounded-xl bg-[#121217] border border-white/20 shadow-lg ${
                        isMe ? 'right-0' : 'left-0'
                      }`}
                    >
                      {['🖤', '🐈‍⬛', '✨', '🦇', '🔥'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="hover:scale-125 transition px-1 py-0.5 text-xs"
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handlePin(msg.id)}
                        className="p-1 hover:text-white text-slate-400 transition"
                        title="Fixar mensagem"
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                      {isMe && (
                        <button
                          type="button"
                          onClick={() => handleDelete(msg.id)}
                          className="p-1 hover:text-red-400 text-slate-400 transition"
                          title="Excluir"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reaction Badges */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {msg.reactions.map((rx) => (
                        <button
                          key={rx.id || rx.emoji}
                          type="button"
                          onClick={() => handleReaction(msg.id, rx.emoji)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 hover:border-white/20 text-[11px] text-slate-300 transition"
                        >
                          <span>{rx.emoji}</span>
                          <span className="text-[10px] font-semibold">{rx.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply target bar */}
      {replyTarget && (
        <div className="px-4 py-1.5 bg-white/[0.04] border-t border-white/5 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Reply className="w-3.5 h-3.5 text-slate-400" />
            <span>Respondendo a @{replyTarget.author?.username}:</span>
            <span className="text-slate-400 truncate max-w-xs">{replyTarget.content}</span>
          </div>
          <button type="button" onClick={() => setReplyTarget(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachment preview */}
      {attachedFile && (
        <div className="px-4 py-2 bg-white/[0.04] border-t border-white/5 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-white">{attachedFile.filename}</span>
            <span className="text-slate-400 text-[10px]">({Math.round(attachedFile.size / 1024)} KB)</span>
          </div>
          <button type="button" onClick={() => setAttachedFile(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 border-t border-white/[0.08] bg-white/[0.02] relative">
        {/* Emoji Picker Popup */}
        {showEmojiPicker && (
          <div className="absolute bottom-16 left-3 z-30 shadow-2xl">
            <LuneEmojiPicker
              onSelectEmoji={(emoji) => {
                setInputText((prev) => prev + emoji);
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}

        {/* GIF Picker Popup */}
        {showGifPicker && (
          <div className="absolute bottom-16 left-3 z-30 shadow-2xl">
            <LuneGifPicker
              onSelectGif={(gif) => {
                setAttachedFile({
                  url: gif.url,
                  filename: `${gif.title}.gif`,
                  size: 500000,
                });
                setShowGifPicker(false);
              }}
              onClose={() => setShowGifPicker(false)}
            />
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
          {/* File Upload Hidden Input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-white/5 active:bg-white/20 hover:bg-white/15 text-slate-400 hover:text-white transition flex items-center justify-center shrink-0"
            title="Anexar arquivo ou imagem"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowGifPicker((p) => !p);
              setShowEmojiPicker(false);
            }}
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-white/5 active:bg-white/20 hover:bg-white/15 text-slate-400 hover:text-white transition flex items-center justify-center shrink-0"
            title="LUNE GIFs"
          >
            <span className="font-black text-[11px] tracking-tight">GIF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker((p) => !p);
              setShowGifPicker(false);
            }}
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-white/5 active:bg-white/20 hover:bg-white/15 text-slate-400 hover:text-white transition flex items-center justify-center shrink-0"
            title="Emojis & LUNE Stickers"
          >
            <Smile className="w-4 h-4" />
          </button>

          <textarea
            rows={1}
            placeholder={`Conversar em #${title.toLowerCase()}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 py-2.5 sm:py-2 px-3 sm:px-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-white/30 resize-none max-h-24 custom-scrollbar"
          />

          <button
            type="submit"
            disabled={!inputText.trim() && !attachedFile}
            className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-white text-black active:bg-slate-300 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-white transition flex items-center justify-center shrink-0 shadow-sm"
            title="Enviar mensagem"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
