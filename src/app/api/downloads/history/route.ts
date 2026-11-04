import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { downloads, releases } from "@/db/schema";
import { getAuth } from "@/lib/auth";

export async function GET(request: Request) {
  await connection();
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Sign in to view download history." }, { status: 401 });

  const history = await getDb().select({
    assetName: downloads.assetName,
    downloadedAt: downloads.downloadedAt,
    version: releases.tagName,
    releaseName: releases.releaseName,
  }).from(downloads)
    .innerJoin(releases, eq(downloads.releaseId, releases.id))
    .where(eq(downloads.userId, session.user.id))
    .orderBy(desc(downloads.downloadedAt))
    .limit(50);

  return Response.json({ history });
}
