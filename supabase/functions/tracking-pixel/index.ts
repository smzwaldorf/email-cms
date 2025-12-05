import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

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
    
    // Check if token is revoked
    // Note: Ideally we check `tracking_tokens` table here, but for MVP pixel speed 
    // we might skip DB check or implement a cache. 
    // For this implementation, we'll assume valid signature is enough for "open" tracking
    // to avoid potential DB latency on every pixel load, 
    // OR we do a swift insert which doubles as validation check if we rely on RLS/Constraints?
    // Actually, we should log the event.
    
    if (payload) {
      const { user_id, newsletter_id } = payload as any;

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
