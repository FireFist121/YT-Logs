// ─── Quota Tracking ──────────────────────────────────────────────────────────
// YouTube Data API v3 default quota: 10,000 units/day
// liveChatMessages.list = ~5 units/call
// channels.list = ~1 unit/call

const DAILY_QUOTA = 10_000;
const QUOTA_KEY = 'yt_quota_usage';
const QUOTA_DATE_KEY = 'yt_quota_date';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

export function getQuotaUsage(): number {
  const storedDate = localStorage.getItem(QUOTA_DATE_KEY);
  if (storedDate !== getTodayString()) {
    // Reset daily quota
    localStorage.setItem(QUOTA_DATE_KEY, getTodayString());
    localStorage.setItem(QUOTA_KEY, '0');
    return 0;
  }
  return parseInt(localStorage.getItem(QUOTA_KEY) ?? '0', 10);
}

export function resetQuotaUsage(): void {
  localStorage.setItem(QUOTA_KEY, '0');
  localStorage.setItem(QUOTA_DATE_KEY, getTodayString());
}

export function consumeQuota(units: number): void {
  const current = getQuotaUsage();
  localStorage.setItem(QUOTA_KEY, String(current + units));
  localStorage.setItem(QUOTA_DATE_KEY, getTodayString());
}

export function getQuotaPercent(): number {
  return Math.min((getQuotaUsage() / DAILY_QUOTA) * 100, 100);
}

export function isQuotaExhausted(): boolean {
  return getQuotaUsage() >= DAILY_QUOTA;
}

export function getQuotaRemaining(): number {
  return Math.max(DAILY_QUOTA - getQuotaUsage(), 0);
}

// ─── Exponential Backoff ─────────────────────────────────────────────────────

export class BackoffController {
  private attempt = 0;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(maxAttempts = 8, baseDelayMs = 5_000, maxDelayMs = 300_000) {
    this.maxAttempts = maxAttempts;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
  }

  next(): number {
    const delay = Math.min(
      this.baseDelayMs * Math.pow(2, this.attempt),
      this.maxDelayMs
    );
    this.attempt = Math.min(this.attempt + 1, this.maxAttempts);
    return delay + Math.random() * 1000; // add jitter
  }

  reset(): void {
    this.attempt = 0;
  }

  isExhausted(): boolean {
    return this.attempt >= this.maxAttempts;
  }
}
