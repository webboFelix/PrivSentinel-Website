import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { profileDetails } from "@/db/schema";
import { getPrincipal } from "@/lib/authorization";
import { getGitHubConfig } from "@/lib/env";
import { canDownload } from "@/lib/permissions";
import { latestPublishedRelease, recordDownload } from "@/services/release-service";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";

const jsonHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  await connection();
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") ||
      (request.headers.has("origin") && !isSameOriginRequest(request))) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403, headers: jsonHeaders });
  }

  const principal = await getPrincipal(request.headers);
  if (!principal) {
    return Response.json({ error: "Authentication is required.", loginUrl: "/login?next=%2Fapi%2Fdownloads%2Flatest" }, { status: 401, headers: jsonHeaders });
  }

  if (!(await enforceRateLimit(request, `download:${principal.actor.id}`, 5, 3600))) {
    return Response.json({ error: "Download limit reached. Try again later." }, { status: 429, headers: jsonHeaders });
  }

  const profileDetailsRow = await getDb().query.profileDetails.findFirst({
    where: eq(profileDetails.userId, principal.actor.id),
  });
  if (!canDownload(profileDetailsRow ? {
    fullName: principal.actor.name,
    phoneNumber: profileDetailsRow.phoneNumber,
    gender: profileDetailsRow.gender,
    countryCode: profileDetailsRow.countryCode,
  } : null)) {
    return Response.json({ error: "Complete your account profile before downloading.", profileUrl: "/account?completeProfile=1" }, { status: 403, headers: jsonHeaders });
  }

  const release = await latestPublishedRelease();
  if (!release) {
    return Response.json({ error: "No stable release is currently available." }, { status: 404, headers: jsonHeaders });
  }
  const installer = release.installer;
  if (!installer) {
    return Response.json({ error: "The latest release does not include a Windows installer." }, { status: 404, headers: jsonHeaders });
  }

  const { owner, repo } = getGitHubConfig();
  let assetUrl: URL;
  try {
    assetUrl = new URL(installer.url);
  } catch {
    return Response.json({ error: "The installer could not be verified." }, { status: 502, headers: jsonHeaders });
  }
  const expectedAssetPath = `/${owner}/${repo}/releases/download/${encodeURIComponent(release.tagName)}/${encodeURIComponent(installer.name)}`;
  if (
    assetUrl.protocol !== "https:" ||
    assetUrl.hostname !== "github.com" ||
    assetUrl.pathname !== expectedAssetPath ||
    !/\.exe$/i.test(installer.name)
  ) {
    return Response.json({ error: "The installer could not be verified." }, { status: 502, headers: jsonHeaders });
  }

  let upstream: Response;
  try {
    upstream = await fetch(assetUrl, {
      headers: { Accept: "application/octet-stream" },
      cache: "no-store",
      redirect: "follow",
    });
  } catch {
    return Response.json({ error: "The installer download is temporarily unavailable." }, { status: 502, headers: jsonHeaders });
  }
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "The installer download is temporarily unavailable." }, { status: 502, headers: jsonHeaders });
  }

  await recordDownload({ userId: principal.actor.id, release });
  const safeName = installer.name.replace(/["\\\r\n]/g, "_");
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(installer.name)}`,
      "Content-Length": String(installer.size),
      "Content-Type": "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
