import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { releaseOverrides, releases as releaseTable } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import {
  getAllReleases,
  getReleaseByVersion,
  type PublishedRelease,
} from "@/lib/github";

function isDatabaseConfigured() {
  const env = getServerEnv();
  return Boolean(env.TURSO_DATABASE_URL && env.TURSO_AUTH_TOKEN);
}

export async function persistReleases(items: PublishedRelease[]) {
  if (!items.length || !isDatabaseConfigured()) return;

  const db = getDb();
  await db.insert(releaseTable).values(items.map((item) => ({
    id: String(item.id),
    version: item.tagName.replace(/^v(?=\d)/i, ""),
    tagName: item.tagName,
    releaseName: item.name,
    releaseNotes: item.body,
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    installerName: item.installer?.name ?? null,
    installerUrl: item.installer?.url ?? null,
    installerSize: item.installer?.size ?? null,
  }))).onConflictDoUpdate({
    target: releaseTable.tagName,
    set: {
      version: sql`excluded."version"`,
      releaseName: sql`excluded."releaseName"`,
      releaseNotes: sql`excluded."releaseNotes"`,
      publishedAt: sql`excluded."publishedAt"`,
      installerName: sql`excluded."installerName"`,
      installerUrl: sql`excluded."installerUrl"`,
      installerSize: sql`excluded."installerSize"`,
      updatedAt: new Date(),
    },
  });
}

export async function refreshReleaseCache() {
  const items = await getAllReleases();
  await persistReleases(items);
  return applyReleaseOverrides(items, false);
}

export async function latestPublishedRelease() {
  const items = await getAllReleases();
  await persistReleases(items);
  return (await applyReleaseOverrides(items, false))[0] ?? null;
}

export async function publishedReleaseByVersion(version: string) {
  const release = await getReleaseByVersion(version);
  if (!release) return null;
  await persistReleases([release]);
  return (await applyReleaseOverrides([release], false))[0] ?? null;
}

export async function releasesForAdministration() {
  const items = await getAllReleases();
  await persistReleases(items);
  return applyReleaseOverrides(items, true);
}

async function applyReleaseOverrides(items: PublishedRelease[], includeUnpublished: boolean) {
  if (!items.length || !isDatabaseConfigured()) return items;
  const overrides = await getDb().select().from(releaseOverrides);
  const overridesByTag = new Map(overrides.map((override) => [override.tagName, override]));
  return items.flatMap((item) => {
    const override = overridesByTag.get(item.tagName);
    if (override && !override.isPublished && !includeUnpublished) return [];
    return [{
      ...item,
      name: override?.releaseName ?? item.name,
      body: override?.releaseNotes ?? item.body,
    }];
  });
}

export async function recordDownload(input: {
  userId: string;
  release: PublishedRelease;
}) {
  const db = getDb();
  const releaseId = String(input.release.id);
  await db.insert(releaseTable).values({
    id: releaseId,
    version: input.release.tagName.replace(/^v(?=\d)/i, ""),
    tagName: input.release.tagName,
    releaseName: input.release.name,
    releaseNotes: input.release.body,
    publishedAt: input.release.publishedAt ? new Date(input.release.publishedAt) : null,
    installerName: input.release.installer?.name ?? null,
    installerUrl: input.release.installer?.url ?? null,
    installerSize: input.release.installer?.size ?? null,
  }).onConflictDoUpdate({
    target: releaseTable.tagName,
    set: { updatedAt: new Date() },
  });

  const { downloads, auditLogs } = await import("@/db/schema");
  await db.insert(downloads).values({
    id: randomUUID(),
    userId: input.userId,
    releaseId,
    assetName: input.release.installer!.name,
  });
  await db.insert(auditLogs).values({
    id: randomUUID(),
    userId: input.userId,
    action: "download.started",
    resource: `release:${input.release.tagName}`,
    metadata: JSON.stringify({ assetName: input.release.installer!.name }),
  });
}
