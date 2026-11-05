"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

function getServerBaseURL() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const candidates = configured?.split(/\s*\|\|\s*/).filter(Boolean) ?? [];
  const selected = process.env.NODE_ENV === "production" ? candidates.at(-1) : candidates[0];
  return selected && URL.canParse(selected)
    ? new URL(selected).origin
    : "http://localhost:3000";
}

export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? getServerBaseURL() : window.location.origin,
  plugins: [adminClient()],
});
