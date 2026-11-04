"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? process.env.NEXT_PUBLIC_APP_URL : window.location.origin,
  plugins: [adminClient()],
});
