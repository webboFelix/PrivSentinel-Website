import { connection } from "next/server";
import { GitHubReleaseError } from "@/lib/github";
import { publishedReleaseByVersion } from "@/services/release-service";

type RouteContext = { params: Promise<{ version: string }> };

export async function GET(_request: Request, context: RouteContext) {
  await connection();
  const { version } = await context.params;
  if (!version || version.length > 100) {
    return Response.json({ error: "Provide a valid release version." }, { status: 400 });
  }
  try {
    const release = await publishedReleaseByVersion(version);
    if (!release) return Response.json({ error: "Release version was not found." }, { status: 404 });
    return Response.json({ release }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=240" } });
  } catch (error) {
    const message = error instanceof GitHubReleaseError
      ? error.message
      : "Release information is temporarily unavailable.";
    return Response.json({ error: message }, { status: 503 });
  }
}
