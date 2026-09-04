import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Reply,
  Trash2,
  X,
  FileText,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react';
import { LuneConversation, LuneMessage, LuneUser } from '../../types';
import {
  supabase,
  isSupabaseConfigured,
  fetchConversationMessages,
  sendRemoteMessage,
} from '../../lib/supabase';

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
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [replyTarget, setReplyTarget] = useState<LuneMessage | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ url: string; filename: string; size: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Other member in DM
  const otherMember = conversation.type === 'DM'
    ? conversation.members.find((m) => m.userId !== currentUser.id) || conversation.members[0]
    : null;

  const title = conversation.name || otherMember?.displayName || 'Conversa LUNE';
  const avatar = conversation.icon || otherMember?.avatar || LUNE_LOGO_URL;
  const subtitle = conversation.type === 'DM'
    ? `@${otherMember?.username || 'amigo'} • ${otherMember?.presence || 'OFFLINE'}`
    : `${conversation.members.length} membros`;

  // 1. Fetch Remote Messages from PostgreSQL
  const loadMessages = useCallback(async () => {
    if (!conversation.id || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const msgs = await fetchConversationMessages(conversation.id, 50);
      setMessages(msgs);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // 2. Realtime Subscription for New Messages
  useEffect(() => {
    if (!conversation.id || !isSupabaseConfigured()) return;

    const channel = supabase
      .channel(`chat-messages-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          const newRow = payload.new as any;
          // Check if we already have this message (optimistic UI)
          setMessages((prev) => {
            if (prev.some((m) => m.id === newRow.id)) return prev;

            // Fetch sender profile or synthesize
            const isMe = newRow.sender_id === currentUser.id;
            const author = isMe
              ? {
                  id: currentUser.id,
                  username: currentUser.username,
                  displayName: currentUser.displayName,
                  avatar: currentUser.avatar,
                  presence: currentUser.presence,
                }
              : {
                  id: otherMember?.userId || newRow.sender_id,
                  username: otherMember?.username || 'user',
                  displayName: otherMember?.displayName || 'Usuário',
                  avatar: otherMember?.avatar,
                  presence: otherMember?.presence || 'OFFLINE',
                };

            const incomingMsg: LuneMessage = {
              id: newRow.id,
              conversationId: newRow.conversation_id,
              authorId: newRow.sender_id,
              author,
              content: newRow.content || '',
              replyTo: undefined,
              reactions: newRow.reactions || [],
              attachments: newRow.attachments || [],
              isPinned: Boolean(newRow.is_pinned),
              createdAt: newRow.created_at,
            };

            return [...prev, incomingMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, currentUser, otherMember]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // 3. Send Message with Authoritative Persistence
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !attachedFile) return;
    if (!isSupabaseConfigured() || !conversation.id) return;

    const content = inputText.trim();
    setInputText('');
    const currentAttachment = attachedFile;
    setAttachedFile(null);
    const currentReply = replyTarget;
    setReplyTarget(null);

    setSending(true);

    try {
      const persistedMsg = await sendRemoteMessage(
        conversation.id,
        currentUser.id,
        content,
        currentReply?.id,
        currentAttachment ? [currentAttachment] : []
      );

      setMessages((prev) => {
        if (prev.some((m) => m.id === persistedMsg.id)) return prev;
        return [...prev, persistedMsg];
      });
    } catch (err: any) {
      console.error('Failed to send message:', err);
      alert(err?.message || 'Falha ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Upload attachment via Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isSupabaseConfigured()) return;

    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `chat-files/${conversation.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('lune-media')
        .upload(path, file);

      if (uploadErr) {
        throw new Error(uploadErr.message);
      }

      const { data } = supabase.storage.from('lune-media').getPublicUrl(path);
      setAttachedFile({
        url: data.publicUrl,
        filename: file.name,
        size: file.size,
      });
    } catch (err: any) {
      alert(`Falha no upload do anexo: ${err?.message || 'Erro de rede'}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#08090f]/95 text-slate-100 overflow-hidden select-none">
      {/* Top Header */}
      <div className="h-16 px-4 sm:px-6 border-b border-white/10 flex items-center justify-between bg-[#0b0c14]/90 backdrop-blur-xl shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {onBackMobile && (
            <button
              onClick={onBackMobile}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition -ml-1"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <LuneAvatar
            src={avatar}
            alt={title}
            size="md"
            presence={conversation.type === 'DM' ? otherMember?.presence : undefined}
          />

          <div className="min-w-0 text-left">
            <h2 className="text-sm font-bold text-white truncate flex items-center gap-1.5">
              {title}
            </h2>
            <p className="text-xs text-indigo-300 font-mono truncate">{subtitle}</p>
          </div>
        </div>

        {/* Top Call Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {conversation.type === 'DM' && otherMember && (
            <>
              <button
                onClick={() => onStartCall(otherMember.userId, 'voice')}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-emerald-500/20 text-slate-300 hover:text-white border border-white/10 transition"
                title="Chamada de Voz"
              >
                <Phone className="w-4 h-4" />
              </button>
              <button
                onClick={() => onStartCall(otherMember.userId, 'video')}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-purple-500/20 text-slate-300 hover:text-white border border-white/10 transition"
                title="Chamada de Vídeo"
              >
                <Video className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={loadMessages}
            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition"
            title="Atualizar Mensagens"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin mr-2" />
            Carregando mensagens da nuvem...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
              <LuneAvatar src={avatar} alt={title} size="md" />
            </div>
            <p className="text-sm font-semibold text-white">Início da conversa com {title}</p>
            <p className="text-xs max-w-sm">
              Envie uma mensagem para começar. O histórico é permanentemente sincronizado em tempo real.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.authorId === currentUser.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 group text-left ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {!isMe && (
                  <LuneAvatar
                    src={msg.author.avatar}
                    alt={msg.author.displayName}
                    size="sm"
                    presence={msg.author.presence}
                  />
                )}

                <div className={`max-w-[80%] sm:max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Header Author Info */}
                  <div className={`flex items-center gap-2 text-[11px] text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className="font-semibold text-slate-300">{msg.author.displayName}</span>
                    <span>•</span>
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed break-words shadow-md ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none border border-indigo-400/30'
                        : 'bg-[#12131d] text-slate-200 rounded-tl-none border border-white/10'
                    }`}
                  >
                    {msg.content}

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {msg.attachments.map((att: any, idx: number) => {
                          const isImage = att.url.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i);
                          if (isImage) {
                            return (
                              <img
                                key={idx}
                                src={att.url}
                                alt="Anexo"
                                className="max-w-xs max-h-60 rounded-xl object-cover border border-white/15 cursor-pointer"
                                onClick={() => window.open(att.url, '_blank')}
                              />
                            );
                          }
                          return (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/10 hover:border-white/25 transition text-xs text-indigo-300"
                            >
                              <FileText className="w-4 h-4" />
                              <span className="truncate">{att.filename || 'Arquivo Anexo'}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment Preview Bar */}
      {attachedFile && (
        <div className="px-4 py-2 bg-[#0c0d15] border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="font-medium truncate max-w-xs">{attachedFile.filename}</span>
            <span className="text-[10px] text-slate-400">({Math.round(attachedFile.size / 1024)} KB)</span>
          </div>
          <button
            onClick={() => setAttachedFile(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Message Input Area */}
      <div className="p-3 sm:p-4 bg-[#0a0a0f]/90 border-t border-white/10 shrink-0 backdrop-blur-xl relative">
        {/* Emoji & GIF Popups */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-4 z-50">
            <LuneEmojiPicker
              onSelectEmoji={(emoji) => {
                setInputText((prev) => prev + emoji);
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}

        {showGifPicker && (
          <div className="absolute bottom-20 left-12 z-50">
            <LuneGifPicker
              onSelectGif={(gifUrl) => {
                setAttachedFile({
                  url: gifUrl,
                  filename: 'gif.gif',
                  size: 0,
                });
                setShowGifPicker(false);
              }}
              onClose={() => setShowGifPicker(false)}
            />
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          {/* Action buttons */}
          <div className="flex items-center gap-1 mb-1.5">
            <button
              type="button"
              onClick={() => {
                setShowEmojiPicker((v) => !v);
                setShowGifPicker(false);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Emojis"
            >
              <Smile className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowGifPicker((v) => !v);
                setShowEmojiPicker(false);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="GIFs Globais"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Anexar Arquivo"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          {/* Text Input Area */}
          <div className="flex-1 rounded-2xl bg-white/[0.04] border border-white/15 focus-within:border-indigo-500/50 transition p-2.5">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Mensagem para ${title}...`}
              rows={1}
              className="w-full bg-transparent border-0 outline-none text-xs sm:text-sm text-white placeholder-slate-500 resize-none max-h-32"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!inputText.trim() && !attachedFile) || sending}
            className="mb-1 p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-600/30 transition shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
