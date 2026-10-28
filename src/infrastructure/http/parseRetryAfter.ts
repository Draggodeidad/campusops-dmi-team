/** HTTP boundary: publish only finite nonnegative milliseconds, never raw headers. */
export function parseRetryAfter(value: string | undefined, nowMs: number): number | undefined {
  if (typeof value !== 'string' || !Number.isFinite(nowMs)) return undefined;
  const text = value.trim();
  const delay = /^\d+(?:\.\d+)?$/.test(text) ? Number(text) * 1000
    : /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(text)
      ? Date.parse(text) - nowMs : NaN;
  return Number.isFinite(delay) && delay >= 0 && Number.isFinite(nowMs + delay) ? delay : undefined;
}
