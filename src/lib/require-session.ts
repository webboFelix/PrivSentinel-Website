import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAuth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";

export async function requireUser(nextPath: string) {
  await connection();
  const env = getServerEnv();
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return session;
}
