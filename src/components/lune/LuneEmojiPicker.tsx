import React, { useState } from 'react';
import { Search, Sparkles, Heart, Clock, Smile, Flame, Shield, Star } from 'lucide-react';
import { LuneEmoji } from '../../types';

export interface LuneEmojiPickerProps {
  onSelectEmoji: (emojiStr: string) => void;
  onClose?: () => void;
}

const DEFAULT_LUNE_EMOJIS: LuneEmoji[] = [
  { id: 'lune_cat', name: 'lune_cat', url: '/logo.svg', isAnimated: false },
  { id: 'lune_chrome', name: 'lune_chrome', url: '/icon.svg', isAnimated: false },
];

const UNICODE_CATEGORIES = [
  { id: 'recent', label: 'Recentes', icon: Clock, emojis: ['💀', '🖤', '🐈‍⬛', '✨', '🔥', '🕷️', '🦇', '🥀'] },
  { id: 'lune', label: 'LUNE', icon: Star, emojis: ['🐈‍⬛', '🌒', '🌑', '🕯️', '🗡️', '⛓️', '🪩', '🗝️', '🖤', '🤍', '🔗', '🦇'] },
  { id: 'smileys', label: 'Carinhas', icon: Smile, emojis: ['😀', '😎', '😈', '😏', '🫡', '🫠', '😵‍💫', '😴', '🤐', '🤫', '🥺', '😳', '🗿'] },
  { id: 'symbols', label: 'Símbolos', icon: Sparkles, emojis: ['⚡', '✨', '🔮', '⭐', '💫', '💥', '💢', '👁️‍🗨️', '🌐', '📡', '💠', '☣️'] },
  { id: 'gothic', label: 'Gothic', icon: Shield, emojis: ['💀', '☠️', '🕷️', '🕸️', '🥀', '🩸', '⚰️', '🪦', '🫀', '🌙', '🦹', '🕯️'] },
  { id: 'favorites', label: 'Favoritos', icon: Heart, emojis: ['🖤', '🤍', '🩶', '💜', '🖤', '🔥', '💯', '👑', '💎'] },
];

export const LuneEmojiPicker: React.FC<LuneEmojiPickerProps> = ({
  onSelectEmoji,
}) => {
  const [activeTab, setActiveTab] = useState<string>('lune');
  const [search, setSearch] = useState<string>('');

  const currentCategory = UNICODE_CATEGORIES.find((c) => c.id === activeTab) || UNICODE_CATEGORIES[0];

  const filteredEmojis = search.trim()
    ? UNICODE_CATEGORIES.flatMap((c) => c.emojis).filter((emoji, idx, self) => self.indexOf(emoji) === idx)
    : currentCategory.emojis;

  return (
    <div className="w-72 sm:w-80 rounded-2xl bg-[#0c0d15]/95 border border-white/15 p-3 shadow-2xl backdrop-blur-2xl text-slate-100 flex flex-col gap-2.5 select-none z-50">
      {/* Search Header */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar emojis..."
          className="w-full text-xs text-slate-200 placeholder-slate-500 bg-white/[0.05] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Category Icons */}
      {!search.trim() && (
        <div className="flex items-center gap-1 border-b border-white/10 pb-2 overflow-x-auto">
          {UNICODE_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`p-1.5 rounded-lg transition ${
                  isActive
                    ? 'bg-white/15 text-white border border-white/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title={cat.label}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      )}

      {/* Custom LUNE Emojis Section */}
      {activeTab === 'lune' && !search.trim() && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            LUNE Custom Emojis
          </span>
          <div className="flex gap-2 p-1.5 rounded-xl bg-white/[0.03] border border-white/5">
            {DEFAULT_LUNE_EMOJIS.map((customEmoji) => (
              <button
                key={customEmoji.id}
                onClick={() => onSelectEmoji(`:${customEmoji.name}:`)}
                className="p-1 rounded-lg hover:bg-white/10 transition active:scale-95 group relative"
                title={`:${customEmoji.name}:`}
              >
                <img src={customEmoji.url} alt={customEmoji.name} className="w-6 h-6 object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Emoji Grid */}
      <div className="max-h-48 overflow-y-auto pr-1 custom-scrollbar">
        <div className="grid grid-cols-7 gap-1">
          {filteredEmojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => onSelectEmoji(emoji)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-white/10 hover:scale-110 active:scale-95 transition"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
