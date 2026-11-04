import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { downloads, releases } from "@/db/schema";
import { getPrincipal } from "@/lib/authorization";

export async function GET(request: Request) {
  await connection();
  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in to view download history." }, { status: 401 });

  const history = await getDb().select({
    assetName: downloads.assetName,
    downloadedAt: downloads.downloadedAt,
    version: releases.tagName,
    releaseName: releases.releaseName,
  }).from(downloads)
    .innerJoin(releases, eq(downloads.releaseId, releases.id))
    .where(eq(downloads.userId, principal.actor.id))
    .orderBy(desc(downloads.downloadedAt))
    .limit(50);

  return Response.json({ history });
}
