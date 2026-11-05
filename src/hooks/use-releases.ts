"use client";

import { useQuery } from "@tanstack/react-query";
import { requestJson } from "@/lib/client-api";

export type ReleaseAsset = { name: string; size: number; downloadCount: number };
export type Release = {
  id: number;
  tagName: string;
  name: string;
  body: string;
  publishedAt: string | null;
  url: string;
  installer: ReleaseAsset | null;
};
export type ReleasesResponse = { latest: Release | null; history: Release[]; error?: string };

export const releasesQueryKey = ["releases"] as const;
export const releaseQueryKey = (version: string) => ["release", version] as const;

export function useReleasesQuery() {
  return useQuery({
    queryKey: releasesQueryKey,
    queryFn: ({ signal }) => requestJson<ReleasesResponse>("/api/releases", { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useReleaseQuery(version: string | null) {
  return useQuery({
    queryKey: releaseQueryKey(version ?? "none"),
    queryFn: ({ signal }) => requestJson<{ release?: Release; error?: string }>(
      `/api/releases/${encodeURIComponent(version ?? "")}`,
      { signal },
    ),
    enabled: Boolean(version),
    staleTime: 5 * 60_000,
  });
}
