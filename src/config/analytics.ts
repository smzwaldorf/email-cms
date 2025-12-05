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
  }
};
