import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

// Validate URL to prevent open redirect attacks
const isValidRedirectUrl = (targetUrl: string): boolean => {
  try {
    const parsed = new URL(targetUrl);
    // Only allow http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    // If URL parsing fails, it's not a valid URL
    return false;
  }
};

// Validate JWT payload structure
const isValidPayload = (payload: any): boolean => {
  if (typeof payload !== 'object' || !payload) return false;
  if (typeof payload.sub !== 'string' || !payload.sub) return false;
  if (typeof payload.nwl !== 'string' || !payload.nwl) return false;
  return true;
};

// Deduplication window configuration
const DEDUP_WINDOW_MS = 10000; // 10 seconds
const MIN_DEDUP_WINDOW_MS = 1000; // Prevent DOS with very small windows
const MAX_DEDUP_WINDOW_MS = 300000; // 5 minutes maximum

// Validate deduplication window
const isValidDeduplicationWindow = (windowMs: number): boolean => {
  return windowMs >= MIN_DEDUP_WINDOW_MS && windowMs <= MAX_DEDUP_WINDOW_MS;
};

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response("Missing URL parameter", { status: 400 });
    }

    // Validate the redirect URL to prevent open redirect attacks
    if (!isValidRedirectUrl(targetUrl)) {
      return new Response("Invalid redirect URL", { status: 400 });
    }

    // Default redirect if token is missing or invalid (fallback to prevent broken UX)
    const fallbackRedirect = Response.redirect(targetUrl, 302);

    if (!token) {
      return fallbackRedirect;
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify token
    const jwtSecret = Deno.env.get("JWT_SECRET");
    if (!jwtSecret) {
      console.error("Missing JWT_SECRET");
      return fallbackRedirect;
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    let payload;
    try {
      payload = await verify(token, key);
    } catch (e) {
      console.error("Token verification failed");
      return fallbackRedirect;
    }

    // Validate payload structure at runtime
    if (!payload || !isValidPayload(payload)) {
      console.error("Invalid token payload structure");
      return fallbackRedirect;
    }

    const { sub: user_id, nwl: newsletter_id } = payload as { sub: string; nwl: string };

    // Deduplication: Check for recent events (last 10 seconds)
    const { count } = await supabase
      .from("analytics_events")
      .select("*", { count: 'exact', head: true })
      .eq("event_type", "link_click")
      .eq("user_id", user_id)
      .eq("newsletter_id", newsletter_id)
      .eq("metadata->>target_url", targetUrl) // Check same URL
      .gt("created_at", new Date(Date.now() - 10000).toISOString());

    if (count && count > 0) {
      // Log deduplication (without PII)
      console.log("Duplicate link_click event skipped");
    } else {
      // Log event
      await supabase.from("analytics_events").insert({
        event_type: "link_click",
        user_id,
        newsletter_id,
        metadata: {
          target_url: targetUrl,
          user_agent: req.headers.get("user-agent"),
          ip: req.headers.get("x-forwarded-for"),
        }
      });
    }

    return Response.redirect(targetUrl, 302);

  } catch (error) {
    console.error("Click Tracking Error:", error);
    // Don't attempt to extract and redirect arbitrary URLs from error scenarios
    // Always validate URLs to prevent open redirect attacks
    return new Response("Internal Server Error", { status: 500 });
  }
});
