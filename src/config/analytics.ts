export const ANALYTICS_CONFIG = {
  trackingPixelSize: 1, // 1x1 pixel
  eventThrottleMs: 500, // Debounce/throttle time for scroll events
  sessionIdStorageKey: 'cms_analytics_session_id',
  tokenExpiryDays: 14,
  retentionMonths: 12,
  endpoints: {
    pixel: '/api/tracking/pixel',
    click: '/api/tracking/click',
  },
  thresholds: {
    scroll: [50, 90], // Percentage depths to track
    heartbeat: 10000, // 10s heartbeat for time tracking
  },
  deduplication: {
    // Window in milliseconds to check for duplicate events
    // Events within this window from the same user for the same action are deduplicated
    windowMs: 10000, // 10 seconds
    // Minimum allowed window (prevents DOS via very small windows)
    minWindowMs: 1000, // 1 second minimum
    // Maximum allowed window (prevents accidentally logging too few events)
    maxWindowMs: 300000, // 5 minutes maximum
  }
};
