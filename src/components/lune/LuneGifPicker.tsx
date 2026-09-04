import React, { useState } from 'react';
import { Search, Heart, Clock, Sparkles, Upload, Flame, Star } from 'lucide-react';
import { LuneGif } from '../../types';

export interface LuneGifPickerProps {
  onSelectGif: (gifUrl: string) => void;
  onClose?: () => void;
}

// Built-in curated LUNE Global GIFs with direct playable media
const DEFAULT_GLOBAL_GIFS: LuneGif[] = [
  {
    id: 'lune-cat-cyber',
    title: 'Cyber Cat Neon',
    tags: ['cyber', 'cat', 'neon', 'lune'],
    url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&auto=format&fit=crop&q=60',
    isGlobal: true,
  },
  {
    id: 'lune-gothic-moon',
    title: 'Gothic Moon Crescent',
    tags: ['gothic', 'moon', 'dark', 'lune'],
    url: 'https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=600&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=200&auto=format&fit=crop&q=60',
    isGlobal: true,
  },
  {
    id: 'lune-liquid-glass',
    title: 'Liquid Glass Chrome Waves',
    tags: ['liquid', 'glass', 'chrome', 'y2k'],
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=60',
    isGlobal: true,
  },
  {
    id: 'lune-dark-matrix',
    title: 'Cyberpunk Dark Digital City',
    tags: ['cyber', 'city', 'matrix', 'night'],
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&auto=format&fit=crop&q=60',
    isGlobal: true,
  },
  {
    id: 'lune-obsidian-panther',
    title: 'Black Cat Gaze',
    tags: ['cat', 'eyes', 'dark', 'obsidian'],
    url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=600&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=200&auto=format&fit=crop&q=60',
    isGlobal: true,
  },
  {
    id: 'lune-retro-static',
    title: 'Y2K Cyber Glitch Static',
    tags: ['y2k', 'glitch', 'static', 'chrome'],
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&auto=format&fit=crop&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=200&auto=format&fit=crop&q=60',
    isGlobal: true,
  },
];

export const LuneGifPicker: React.FC<LuneGifPickerProps> = ({
  onSelectGif,
}) => {
  const [activeTab, setActiveTab] = useState<'GLOBAL' | 'TRENDING' | 'FAVORITES' | 'RECENT'>('GLOBAL');
  const [search, setSearch] = useState<string>('');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('lune_favorite_gifs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleFavorite = (gifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(gifId) ? prev.filter((id) => id !== gifId) : [...prev, gifId];
      try {
        localStorage.setItem('lune_favorite_gifs', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const filteredGifs = DEFAULT_GLOBAL_GIFS.filter((gif) => {
    if (activeTab === 'FAVORITES') {
      return favorites.includes(gif.id);
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return gif.title.toLowerCase().includes(q) || gif.tags.some((t) => t.includes(q));
  });

  return (
    <div className="w-80 sm:w-96 rounded-2xl bg-[#0c0d15]/95 border border-white/15 p-3.5 shadow-2xl backdrop-blur-2xl text-slate-100 flex flex-col gap-3 select-none z-50">
      {/* Search Header */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar GIFs do LUNE..."
          className="w-full text-xs text-slate-200 placeholder-slate-500 bg-white/[0.05] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-2">
        {(['GLOBAL', 'TRENDING', 'FAVORITES', 'RECENT'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
              activeTab === tab
                ? 'bg-white/15 text-white font-semibold border border-white/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'GLOBAL' && 'LUNE Global'}
            {tab === 'TRENDING' && 'Em Alta'}
            {tab === 'FAVORITES' && 'Favoritos'}
            {tab === 'RECENT' && 'Recentes'}
          </button>
        ))}
      </div>

      {/* GIF Grid */}
      <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
        {filteredGifs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {activeTab === 'FAVORITES' ? 'Nenhum GIF favoritado ainda.' : 'Nenhum GIF encontrado.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredGifs.map((gif) => {
              const isFav = favorites.includes(gif.id);
              return (
                <div
                  key={gif.id}
                  onClick={() => onSelectGif(gif.url)}
                  className="relative group rounded-xl overflow-hidden aspect-video bg-black/40 border border-white/10 hover:border-white/30 cursor-pointer transition active:scale-[0.98]"
                >
                  <img
                    src={gif.thumbnailUrl}
                    alt={gif.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-between p-2">
                    <span className="text-[10px] text-white font-medium truncate drop-shadow">
                      {gif.title}
                    </span>
                    <button
                      onClick={(e) => toggleFavorite(gif.id, e)}
                      className="p-1 rounded-md bg-black/50 text-white hover:text-rose-400 transition"
                      title={isFav ? 'Remover dos favoritos' : 'Favoritar'}
                    >
                      <Heart className={`w-3 h-3 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
