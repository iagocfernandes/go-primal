"use client";

import { useEffect } from "react";
import { recoveryRedirect } from "@/lib/supabase/recovery";

export default function RecoveryRedirect() {
  useEffect(() => {
    // Auth's default Site URL can be any page, including an authenticated home.
    // Route its callback without initializing an Auth client or consuming tokens.
    const target = recoveryRedirect(new URL(window.location.href));
    if (target) window.location.replace(target);
  }, []);

  return null;
}
