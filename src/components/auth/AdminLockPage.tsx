import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';

interface AdminLockPageProps {
  onUnlock: () => void;
}

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

export default function AdminLockPage({ onUnlock }: AdminLockPageProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('yt_mod_unlocked', 'true');
      onUnlock();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        <div className="glass-panel p-8 rounded-3xl text-center shadow-2xl">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#111] border border-white/10 rounded-2xl mb-6 shadow-[0_0_30px_rgba(255,0,0,0.1)]">
            <Lock size={28} className="text-[#FF0000]" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">Restricted Access</h1>
          <p className="text-[#888] text-sm mb-8">
            Please enter the admin password to access the YT Mod Monitor.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password…"
                className={`
                  w-full bg-[#0a0a0a]/50 backdrop-blur-md rounded-xl
                  px-4 py-3 text-sm text-center text-white placeholder-[#555]
                  focus:outline-none focus:ring-2 transition-all duration-300
                  ${error 
                    ? 'border border-red-500/50 focus:ring-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                    : 'border border-white/10 focus:border-[#FF0000]/70 focus:ring-[#FF0000]/20'
                  }
                `}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!password}
              className="
                w-full flex items-center justify-center gap-2 py-3
                bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400
                text-white font-semibold rounded-xl text-sm
                transition-all duration-300
                shadow-[0_0_15px_rgba(225,29,72,0.3)] hover:shadow-[0_0_25px_rgba(225,29,72,0.5)]
                disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none
              "
            >
              Unlock Access
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
      
      {/* Privacy Policy Footer */}
      <div className="absolute bottom-4 text-center w-full">
        <div className="flex items-center justify-center gap-3 text-xs text-gray-500">
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">Privacy Policy</a>
          <span>•</span>
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
