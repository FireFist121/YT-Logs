import React, { useState } from 'react';
import { Tv2, Shield, Eye, Database, RefreshCcw, AlertCircle } from 'lucide-react';
import { requestLogin } from '../../hooks/useTokenRefresh';
import { useAuthStore } from '../../store/authStore';
import { getMyChannel } from '../../lib/youtube';
import toast from 'react-hot-toast';

interface LoginPageProps {
  onAuthenticated: () => void;
}

const features = [
  { icon: Eye, label: 'Live Mod Feed', desc: 'Real-time moderator action monitoring' },
  { icon: Database, label: 'Banned DB', desc: 'Persistent IndexedDB of all bans' },
  { icon: RefreshCcw, label: 'Change Detection', desc: 'Detect profile name/pic changes' },
  { icon: Shield, label: 'Secure Auth', desc: 'OAuth 2.0 — no password stored' },
];

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function LoginPage({ onAuthenticated }: LoginPageProps) {
  const { setToken, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMissingClientId = !clientId || clientId === 'YOUR_CLIENT_ID.apps.googleusercontent.com';

  const handleLogin = () => {
    if (isMissingClientId) {
      setError('Missing Google Client ID. Please add VITE_GOOGLE_CLIENT_ID to your .env file.');
      return;
    }

    setIsLoading(true);
    setError(null);

    requestLogin(
      async (token, expiresIn) => {
        setToken(token, expiresIn);

        try {
          // Fetch user profile
          const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const profile = await profileRes.json();

          // Fetch YouTube channel info
          const channel = await getMyChannel(token);

          setUser({
            email: profile.email,
            name: profile.name,
            picture: profile.picture,
            channelId: channel?.id,
            channelName: channel?.snippet?.title,
            channelPicture: channel?.snippet?.thumbnails?.default?.url,
          });

          toast.success('Signed in successfully!', {
            style: { background: '#1a1a1a', color: '#fff', border: '1px solid #22c55e' },
          });
          onAuthenticated();
        } catch (err) {
          console.error('Failed to load profile:', err);
          // Still allow login even if channel fetch fails
          onAuthenticated();
        } finally {
          setIsLoading(false);
        }
      },
      (errMsg) => {
        setIsLoading(false);
        setError(errMsg === 'access_denied' ? 'Sign-in was cancelled.' : `Auth error: ${errMsg}`);
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#FF0000]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[#FF0000]/3 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#111] border border-[#2a2a2a] rounded-2xl mb-5 shadow-[0_0_40px_rgba(255,0,0,0.15)]">
            <Tv2 size={40} className="text-[#FF0000]" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
            YT Mod Monitor
          </h1>
          <p className="text-[#888] text-sm leading-relaxed">
            Real-time YouTube Live moderator action tracker.<br />
            Sign in with your YouTube channel account to begin.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {features.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="bg-[#111] border border-[#1e1e1e] rounded-xl p-4 group hover:border-[#FF0000]/30 transition-colors"
            >
              <Icon size={18} className="text-[#FF0000] mb-2 group-hover:scale-110 transition-transform" />
              <p className="text-white text-xs font-semibold mb-0.5">{label}</p>
              <p className="text-[#666] text-[10px] leading-snug">{desc}</p>
            </div>
          ))}
        </div>

        {/* Error banner */}
        {isMissingClientId && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-4 flex gap-3">
            <AlertCircle size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-orange-400 text-xs font-semibold mb-1">Setup Required</p>
              <p className="text-orange-300/80 text-xs leading-relaxed">
                Create a <code className="bg-orange-500/20 px-1 rounded">.env</code> file and add your{' '}
                <code className="bg-orange-500/20 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code>.<br />
                See <code className="bg-orange-500/20 px-1 rounded">.env.example</code> for instructions.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex gap-2">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Sign-in button */}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="
            w-full flex items-center justify-center gap-3 py-3.5 px-6
            bg-[#FF0000] hover:bg-[#cc0000] active:bg-[#990000]
            text-white font-semibold rounded-xl
            transition-all duration-200
            shadow-[0_4px_20px_rgba(255,0,0,0.35)] hover:shadow-[0_6px_30px_rgba(255,0,0,0.5)]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
            text-sm
          "
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              {/* Google logo SVG */}
              <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
                <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Sign in with Google</span>
            </>
          )}
        </button>

        {/* Permissions note */}
        <p className="text-center text-[#555] text-[10px] mt-4 leading-relaxed">
          Requires YouTube read + force-ssl scopes to detect moderator actions.
          <br />
          You must be the channel owner or a moderator of the stream.
        </p>
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
