import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v2.9.1/mod.ts";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    const targetUrl = url.searchParams.get("url");

    if (!targetUrl) {
      return new Response("Missing URL parameter", { status: 400 });
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
      console.error("Token verification failed:", e);
      return fallbackRedirect;
    }
    
    if (payload) {
      const { user_id, newsletter_id } = payload as any;

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
    // Try to extract URL from query params manually if URL parsing failed, 
    // or just return 500, but ideally we redirect if we can at all find a URL.
    const urlParam = req.url.split("url=")[1]?.split("&")[0];
    if (urlParam) {
       return Response.redirect(decodeURIComponent(urlParam), 302);
    }
    return new Response("Internal Server Error", { status: 500 });
  }
});
