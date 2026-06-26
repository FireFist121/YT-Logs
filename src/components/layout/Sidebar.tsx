import React, { useState, useEffect } from 'react';
import { Activity, Database, Tv2, ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { fetchWatchedChannels } from '../../lib/db';

interface SidebarProps {
  activePage: 'monitor' | 'database' | 'watchlist';
  onNavigate: (page: 'monitor' | 'database' | 'watchlist') => void;
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { id: 'monitor' as const, label: 'Live Monitor', icon: Activity },
  { id: 'watchlist' as const, label: 'Watch List', icon: Bell },
  { id: 'database' as const, label: 'Banned Users', icon: Database },
];

export default function Sidebar({ activePage, onNavigate, collapsed, onToggle }: SidebarProps) {
  const [liveChannels, setLiveChannels] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      fetchWatchedChannels().then(channels => {
        setLiveChannels(channels.filter(c => c.isLive).length);
      });
    };
    updateCount();

    const interval = setInterval(updateCount, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);
  return (
    <aside
      className={`
        relative flex flex-col glass-panel z-10
        transition-all duration-300 ease-in-out flex-shrink-0
        ${collapsed ? 'w-16' : 'w-56'}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-[#2a2a2a] ${collapsed ? 'justify-center px-2' : ''}`}>
        <div className="flex-shrink-0 w-8 h-8 bg-[#FF0000] rounded-lg flex items-center justify-center shadow-[0_0_12px_rgba(255,0,0,0.4)]">
          <Tv2 size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-white text-sm font-bold leading-tight">YT Mod</p>
            <p className="text-[#aaa] text-xs leading-tight">Monitor</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activePage === id;
          const badge = id === 'watchlist' && liveChannels > 0 ? liveChannels : 0;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={collapsed ? label : undefined}
              className={`
                w-full flex items-center gap-3 rounded-lg transition-all duration-200
                ${collapsed ? 'justify-center p-3' : 'px-3 py-2.5'}
                ${isActive
                  ? 'bg-[#FF0000]/15 text-[#FF0000] border border-[#FF0000]/30 shadow-[0_0_8px_rgba(255,0,0,0.15)]'
                  : 'text-[#888] hover:bg-[#1e1e1e] hover:text-white border border-transparent'
                }
              `}
            >
              <div className="relative flex-shrink-0">
                <Icon size={18} />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#FF0000] rounded-full text-[8px] text-white font-bold flex items-center justify-center animate-pulse">
                    {badge}
                  </span>
                )}
              </div>
              {!collapsed && <span className="text-sm font-medium truncate flex-1 text-left">{label}</span>}
              {!collapsed && badge > 0 && (
                <span className="text-[9px] font-bold bg-[#FF0000] text-white px-1.5 py-0.5 rounded-full">
                  {badge} LIVE
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Credits */}
      <div className={`mt-auto px-4 py-4 border-t border-[#2a2a2a] ${collapsed ? 'hidden' : 'block'}`}>
        <p className="text-[10px] text-[#555] text-center font-medium tracking-wide">
          Made By - FireFist
        </p>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10
          w-6 h-6 rounded-full bg-[#2a2a2a] border border-[#3a3a3a]
          flex items-center justify-center text-[#888]
          hover:bg-[#3a3a3a] hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
