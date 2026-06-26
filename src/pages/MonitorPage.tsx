import React, { useEffect } from 'react';
import StreamInput from '../components/monitor/StreamInput';
import ModEventFeed from '../components/monitor/ModEventFeed';
import { useMonitorStore } from '../store/monitorStore';
import { fetchModEvents } from '../lib/db';

export default function MonitorPage() {
  const { status, setStatus, setVideoId, setLiveChatId, addEvents } = useMonitorStore();

  useEffect(() => {
    if (status === 'idle') {
      fetch('/api/monitor/status')
        .then(res => res.json())
        .then(data => {
          if (data.activeMonitors && data.activeMonitors.length > 0) {
            const first = data.activeMonitors[0];
            setLiveChatId(first.liveChatId);
            if (first.videoId) setVideoId(first.videoId);
            setStatus('active');
          }
        })
        .catch(() => {});
    }
  }, [status, setStatus, setLiveChatId]);

  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(async () => {
      const data = await fetchModEvents();
      if (data && data.length > 0) {
        addEvents(data as any);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [status, addEvents]);

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <StreamInput />
      <ModEventFeed />
    </div>
  );
}
