import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

// Validate JWT payload structure
const isValidPayload = (payload: any): boolean => {
  if (typeof payload !== 'object' || !payload) return false;
  if (typeof payload.user_id !== 'string' || !payload.user_id) return false;
  if (typeof payload.newsletter_id !== 'string' || !payload.newsletter_id) return false;
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

    if (!token) {
      return new Response(TRANSPARENT_GIF, {
        headers: { "Content-Type": "image/gif" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify token
    const jwtSecret = Deno.env.get("JWT_SECRET");
    if (!jwtSecret) {
      throw new Error("Missing JWT_SECRET configuration");
    }

    // Verify JWT using djwt
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const payload = await verify(token, key);

    // Validate payload structure at runtime
    if (!isValidPayload(payload)) {
      console.error("Invalid token payload structure");
      return new Response(TRANSPARENT_GIF, {
        headers: { "Content-Type": "image/gif" },
      });
    }

    const { user_id, newsletter_id } = payload as { user_id: string; newsletter_id: string };

    // Deduplication: Check for recent events (last 10 seconds)
    const { count } = await supabase
      .from("analytics_events")
      .select("*", { count: 'exact', head: true })
      .eq("event_type", "email_open")
      .eq("user_id", user_id)
      .eq("newsletter_id", newsletter_id)
      .gt("created_at", new Date(Date.now() - 10000).toISOString());

    if (count && count > 0) {
      // Log deduplication (without PII)
      console.log("Duplicate email_open event skipped");
    } else {
      // Log event
      await supabase.from("analytics_events").insert({
        event_type: "email_open",
        user_id,
        newsletter_id,
        metadata: {
          user_agent: req.headers.get("user-agent"),
          ip: req.headers.get("x-forwarded-for"),
        }
      });
    }

    return new Response(TRANSPARENT_GIF, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });

  } catch (error) {
    // Fail silently for pixel to ensure image usually loads (or at least doesn't show broken icon if possible, though browsers handle 500s differently for images)
    // Actually, standard practice is to return the GIF even on error to avoid broken image icon.
    console.error("Pixel Error:", error);
    return new Response(TRANSPARENT_GIF, {
      headers: { "Content-Type": "image/gif" },
    });
  }
});
