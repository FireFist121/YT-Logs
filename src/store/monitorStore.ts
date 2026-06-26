import { create } from 'zustand';
import type { DetectedModEvent } from '../lib/youtube';

export type MonitorStatus = 'idle' | 'loading' | 'active' | 'error' | 'ended' | 'quota_exceeded';

interface MonitorState {
  videoId: string | null;
  liveChatId: string | null;
  status: MonitorStatus;
  errorMessage: string | null;
  events: DetectedModEvent[];
  nextPageToken: string | undefined;
  pollIntervalMs: number;
  lastPollAt: Date | null;
  totalEventsDetected: number;

  setVideoId: (id: string) => void;
  setLiveChatId: (id: string) => void;
  setStatus: (status: MonitorStatus, error?: string) => void;
  addEvents: (events: DetectedModEvent[]) => void;
  setNextPageToken: (token: string | undefined) => void;
  setPollInterval: (ms: number) => void;
  setLastPollAt: (date: Date) => void;
  resetMonitor: () => void;
  clearEvents: () => void;
}

export const useMonitorStore = create<MonitorState>((set) => ({
  videoId: null,
  liveChatId: null,
  status: 'idle',
  errorMessage: null,
  events: [],
  nextPageToken: undefined,
  pollIntervalMs: 7000,
  lastPollAt: null,
  totalEventsDetected: 0,

  setVideoId: (id) => set({ videoId: id }),
  setLiveChatId: (id) => set({ liveChatId: id }),
  setStatus: (status, error) => set({ status, errorMessage: error ?? null }),

  addEvents: (newEvents) =>
    set((state) => {
      // Deduplicate: skip any event whose ID already exists in the feed
      const existingIds = new Set(state.events.map((e) => e.id));
      const unique = newEvents.filter((e) => !existingIds.has(e.id));
      if (unique.length === 0) return state; // nothing new
      return {
        events: [...unique.reverse(), ...state.events].slice(0, 500),
        totalEventsDetected: state.totalEventsDetected + unique.length,
      };
    }),

  setNextPageToken: (token) => set({ nextPageToken: token }),
  setPollInterval: (ms) => set({ pollIntervalMs: ms }),
  setLastPollAt: (date) => set({ lastPollAt: date }),

  resetMonitor: () =>
    set({
      videoId: null,
      liveChatId: null,
      status: 'idle',
      errorMessage: null,
      events: [],
      nextPageToken: undefined,
      lastPollAt: null,
      totalEventsDetected: 0,
    }),
    
  clearEvents: () => set({ events: [] }),
}));
