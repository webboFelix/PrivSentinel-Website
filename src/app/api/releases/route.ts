import { connection } from "next/server";
import { GitHubReleaseError } from "@/lib/github";
import { refreshReleaseCache } from "@/services/release-service";

export async function GET() {
  await connection();
  try {
    const releases = await refreshReleaseCache();
    return Response.json({
      latest: releases[0] ?? null,
      history: releases,
    }, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=240" },
    });
  } catch (error) {
    const message = error instanceof GitHubReleaseError
      ? error.message
      : "Release information is temporarily unavailable.";
    return Response.json({ latest: null, history: [], error: message }, { status: 503 });
  }
}
