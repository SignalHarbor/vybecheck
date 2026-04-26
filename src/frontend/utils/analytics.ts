import posthog from 'posthog-js';

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: false, // manual — no router, page = store state
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
  });
}

export { posthog as analytics };
