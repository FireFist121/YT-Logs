import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  discordTimeoutWebhook: string;
  discordBanWebhook: string;
  setDiscordTimeoutWebhook: (url: string) => void;
  setDiscordBanWebhook: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      discordTimeoutWebhook: '',
      discordBanWebhook: '',
      setDiscordTimeoutWebhook: (url) => set({ discordTimeoutWebhook: url }),
      setDiscordBanWebhook: (url) => set({ discordBanWebhook: url }),
    }),
    {
      name: 'yt-logs-settings', // name of the item in the storage
    }
  )
);
