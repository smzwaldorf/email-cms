export interface TrackingMetadata {
  source?: string;
  campaign?: string;
  medium?: string;
  duration_seconds?: number;
  scroll_depth?: number;
  target_url?: string;
  user_agent?: string;
  device_type?: string;
  [key: string]: any;
}

export interface SessionData {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  pageViews: number;
}

export interface JWTPayload {
  sub: string; // user_id
  nwl: string; // newsletter_id
  cls: string[]; // class_ids
  iat: number;
  exp: number;
  jti: string; // token id
}

export type TokenRevocationReason = 'user_logout' | 'security_breach' | 'admin_action';
