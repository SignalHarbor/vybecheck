import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;

export function getAnalyticsServer(): PostHog | null {
  if (_client) return _client;

  const key = process.env.POSTHOG_KEY;
  if (!key) return null;

  _client = new PostHog(key, {
    host: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
    flushAt: 1,   // send immediately — low-volume server events
    flushInterval: 0,
  });

  return _client;
}
