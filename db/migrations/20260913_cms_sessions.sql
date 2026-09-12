-- Additive, repeatable migration. Existing CMS content and Identity grants are untouched.
CREATE TABLE IF NOT EXISTS cms_browser_sessions (
  id_hash text PRIMARY KEY,
  issuer text NOT NULL,
  subject text NOT NULL,
  credentials text,
  access_expires_at timestamptz NOT NULL,
  identity_snapshot jsonb,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','reauthentication_required','revoked')),
  generation integer NOT NULL DEFAULT 0,
  refresh_owner uuid,
  refresh_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  remembered_until timestamptz NOT NULL DEFAULT (now() + interval '400 days')
);
CREATE INDEX IF NOT EXISTS cms_browser_sessions_retention ON cms_browser_sessions(remembered_until);
CREATE TABLE IF NOT EXISTS cms_login_flows (
  state_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  encrypted_flow text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);
CREATE INDEX IF NOT EXISTS cms_login_flows_expiry ON cms_login_flows(expires_at);
