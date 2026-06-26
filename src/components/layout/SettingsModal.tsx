import React, { useState } from 'react';
import { X, Webhook, Save, Check } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import toast from 'react-hot-toast';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const {
    discordTimeoutWebhook,
    discordBanWebhook,
    setDiscordTimeoutWebhook,
    setDiscordBanWebhook,
  } = useSettingsStore();

  const [timeoutUrl, setTimeoutUrl] = useState(discordTimeoutWebhook);
  const [banUrl, setBanUrl] = useState(discordBanWebhook);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setDiscordTimeoutWebhook(timeoutUrl.trim());
    setDiscordBanWebhook(banUrl.trim());
    
    setTimeout(() => {
      setIsSaving(false);
      toast.success('Settings saved successfully!');
      onClose();
    }, 500);
  };

  const testWebhook = async (url: string, type: 'timeout' | 'ban') => {
    if (!url) {
      toast.error('Please enter a webhook URL first.');
      return;
    }

    const toastId = toast.loading('Sending test message...');
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `🔔 Test ${type === 'ban' ? 'Ban' : 'Timeout'} Webhook`,
            description: 'If you are seeing this, your webhook is configured correctly!',
            color: type === 'ban' ? 0xff0000 : 0xf97316,
          }]
        }),
      });

      if (res.ok) {
        toast.success('Test message sent!', { id: toastId });
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      toast.error(`Failed to send test message: ${err.message}`, { id: toastId });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] animate-[slideUp_0.2s_ease-out]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e1e1e] flex items-center justify-center border border-[#333]">
              <Webhook className="text-[#888]" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Settings</h2>
              <p className="text-xs text-[#666]">Configure Discord webhooks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#666] hover:text-white hover:bg-[#1e1e1e] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 flex flex-col gap-6">
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1.5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                Timeout Events Webhook
              </label>
              <p className="text-xs text-[#666] mb-2">
                Sent when a moderator issues a temporary timeout.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={timeoutUrl}
                  onChange={(e) => setTimeoutUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#FF0000]/40 focus:ring-1 focus:ring-[#FF0000]/20 transition-all font-mono"
                />
                <button
                  onClick={() => testWebhook(timeoutUrl, 'timeout')}
                  className="px-3 py-2 bg-[#1e1e1e] hover:bg-[#2a2a2a] text-xs font-medium text-white rounded-xl border border-[#333] transition-colors whitespace-nowrap"
                >
                  Test
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-[#2a2a2a]">
              <label className="block text-sm font-medium text-white mb-1.5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Permanent Ban Webhook
              </label>
              <p className="text-xs text-[#666] mb-2">
                Sent when a moderator issues a permanent ban.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={banUrl}
                  onChange={(e) => setBanUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#FF0000]/40 focus:ring-1 focus:ring-[#FF0000]/20 transition-all font-mono"
                />
                <button
                  onClick={() => testWebhook(banUrl, 'ban')}
                  className="px-3 py-2 bg-[#1e1e1e] hover:bg-[#2a2a2a] text-xs font-medium text-white rounded-xl border border-[#333] transition-colors whitespace-nowrap"
                >
                  Test
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-[#2a2a2a]">
              <label className="block text-sm font-medium text-white mb-1.5 flex items-center gap-2">
                API Quota
              </label>
              <p className="text-xs text-[#666] mb-3 leading-relaxed">
                If the app thinks your quota is exhausted but you still have units left in Google Cloud Console, you can reset the local counter.
              </p>
              <button
                onClick={() => {
                  import('../../lib/quota').then((m) => {
                    m.resetQuotaUsage();
                    toast.success('Local quota counter reset!');
                    setTimeout(() => window.location.reload(), 1000);
                  });
                }}
                className="w-full py-2.5 bg-[#1e1e1e] hover:bg-[#2a2a2a] text-xs font-medium text-white rounded-xl border border-[#333] transition-colors"
              >
                Reset Local Quota Counter
              </button>
            </div>
          </div>
          
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#2a2a2a] bg-[#0d0d0d] rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-[#888] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#FF0000] hover:bg-[#FF0000]/90 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <Check size={16} className="animate-pulse" />
            ) : (
              <Save size={16} />
            )}
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
}
