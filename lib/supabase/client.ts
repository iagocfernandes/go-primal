"use client";
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient(detectSessionInUrl = true) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    detectSessionInUrl ? undefined : {
      // The reset screen consumes callbacks explicitly, including native implicit links.
      // Give it its own cookie-backed client so another singleton cannot consume them first.
      isSingleton: false,
      auth: { detectSessionInUrl: false },
    },
  );
}
