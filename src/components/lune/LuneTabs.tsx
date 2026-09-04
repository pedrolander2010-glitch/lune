import React from 'react';

export interface LuneTabItem<T extends string = string> {
  id: T;
  label: string;
  badge?: number | string;
  icon?: React.ReactNode;
}

export interface LuneTabsProps<T extends string = string> {
  tabs: LuneTabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  variant?: 'pill' | 'underline';
}

export function LuneTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  variant = 'pill',
}: LuneTabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div className={`flex border-b border-white/10 gap-1 overflow-x-auto ${className}`}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? 'border-white text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white text-black' : 'bg-white/10 text-slate-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex rounded-2xl bg-white/[0.04] p-1 border border-white/10 gap-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex-1 py-2 px-3 text-xs font-medium rounded-xl transition flex items-center justify-center gap-1.5 select-none ${
              isActive
                ? 'bg-white/15 text-white font-semibold shadow-sm border border-white/15'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isActive ? 'bg-white text-black' : 'bg-white/10 text-slate-300'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
