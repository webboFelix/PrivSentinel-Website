import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getServerEnv } from "@/lib/env";
import { getPrincipal } from "@/lib/authorization";

export async function requireUser(nextPath: string) {
  await connection();
  const env = getServerEnv();
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const principal = await getPrincipal(await headers());
  if (!principal) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return principal.session;
}
