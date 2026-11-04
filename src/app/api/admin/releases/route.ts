import { count, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { auditLogs, downloads, releaseOverrides, releases } from "@/db/schema";
import { isResponse, requireAdminApi } from "@/lib/admin-api";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";
import { releasesForAdministration } from "@/services/release-service";

const releaseUpdateSchema = z.object({
  tagName: z.string().trim().min(1).max(100),
  releaseName: z.string().trim().min(1).max(200).optional(),
  releaseNotes: z.string().max(10_000).optional(),
  isPublished: z.boolean().optional(),
}).strict().refine((value) =>
  value.releaseName !== undefined || value.releaseNotes !== undefined || value.isPublished !== undefined,
);

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  const principal = await requireAdminApi(request);
  if (isResponse(principal)) return principal;

  const [githubReleases, overrides, counts] = await Promise.all([
    releasesForAdministration(),
    getDb().select().from(releaseOverrides),
    getDb().select({
      tagName: releases.tagName,
      count: count(downloads.id),
    }).from(releases)
      .leftJoin(downloads, eq(releases.id, downloads.releaseId))
      .groupBy(releases.tagName),
  ]);
  const overrideByTag = new Map(overrides.map((override) => [override.tagName, override]));
  const downloadCountByTag = new Map(counts.map((entry) => [entry.tagName, entry.count]));
  return Response.json({
    releases: githubReleases.map((release) => {
      const override = overrideByTag.get(release.tagName);
      return {
        ...release,
        isPublished: override?.isPublished ?? true,
        downloadCount: downloadCountByTag.get(release.tagName) ?? 0,
      };
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await requireAdminApi(request);
  if (isResponse(principal)) return principal;
  if (!(await enforceRateLimit(request, `release-management:${principal.actor.id}`, 60, 3600))) {
    return Response.json({ error: "Too many release changes. Try again later." }, { status: 429 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Provide a valid release update." }, { status: 400 });
  }
  const parsed = releaseUpdateSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Review the release fields and try again." }, { status: 400 });

  const releasesFromGitHub = await releasesForAdministration();
  if (!releasesFromGitHub.some((release) => release.tagName === parsed.data.tagName)) {
    return Response.json({ error: "Only an existing published GitHub release can be managed." }, { status: 404 });
  }

  const current = await getDb().query.releaseOverrides.findFirst({
    where: eq(releaseOverrides.tagName, parsed.data.tagName),
  });
  const now = new Date();
  const values = {
    tagName: parsed.data.tagName,
    releaseName: parsed.data.releaseName ?? current?.releaseName ?? null,
    releaseNotes: parsed.data.releaseNotes ?? current?.releaseNotes ?? null,
    isPublished: parsed.data.isPublished ?? current?.isPublished ?? true,
    updatedBy: principal.actor.id,
    updatedAt: now,
  };
  await getDb().insert(releaseOverrides).values(values).onConflictDoUpdate({
    target: releaseOverrides.tagName,
    set: {
      releaseName: values.releaseName,
      releaseNotes: values.releaseNotes,
      isPublished: values.isPublished,
      updatedBy: values.updatedBy,
      updatedAt: now,
    },
  });
  await getDb().insert(auditLogs).values({
    id: randomUUID(),
    userId: principal.actor.id,
    action: parsed.data.isPublished === undefined
      ? "admin.release.metadata_updated"
      : parsed.data.isPublished
        ? "admin.release.published"
        : "admin.release.unpublished",
    resource: "release",
    targetType: "release",
    targetId: parsed.data.tagName,
    metadata: JSON.stringify({
      releaseNameUpdated: parsed.data.releaseName !== undefined,
      releaseNotesUpdated: parsed.data.releaseNotes !== undefined,
      isPublished: values.isPublished,
    }),
  });

  return Response.json({ success: true, release: values }, {
    headers: { "Cache-Control": "no-store" },
  });
}
