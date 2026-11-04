import { z } from "zod";
import { getGitHubConfig, getServerEnv } from "@/lib/env";

const githubAssetSchema = z.object({
  name: z.string(),
  size: z.number().int().nonnegative(),
  browser_download_url: z.string().url(),
  download_count: z.number().int().nonnegative().optional().default(0),
});

const githubReleaseSchema = z.object({
  id: z.number().int(),
  tag_name: z.string().min(1),
  name: z.string().nullable(),
  body: z.string().nullable(),
  published_at: z.string().datetime({ offset: true }).nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  html_url: z.string().url(),
  assets: z.array(githubAssetSchema),
});

export type WindowsInstaller = {
  name: string;
  size: number;
  downloadCount: number;
  url: string;
};

export type PublishedRelease = {
  id: number;
  tagName: string;
  name: string;
  body: string;
  publishedAt: string | null;
  url: string;
  installer: WindowsInstaller | null;
};

export class GitHubReleaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubReleaseError";
  }
}

export function getWindowsInstaller(release: PublishedRelease): WindowsInstaller | null {
  return release.installer;
}

function mapRelease(value: z.infer<typeof githubReleaseSchema>): PublishedRelease {
  const installers = value.assets.filter((asset) => /\.exe$/i.test(asset.name));
  const installer =
    installers.find((asset) => /(setup|installer|install)/i.test(asset.name)) ?? installers[0];

  return {
    id: value.id,
    tagName: value.tag_name,
    name: value.name?.trim() || value.tag_name,
    body: value.body ?? "",
    publishedAt: value.published_at,
    url: value.html_url,
    installer: installer
      ? {
          name: installer.name,
          size: installer.size,
          downloadCount: installer.download_count,
          url: installer.browser_download_url,
        }
      : null,
  };
}

export function parseGitHubReleases(payload: unknown): PublishedRelease[] {
  const parsed = z.array(githubReleaseSchema).safeParse(payload);
  if (!parsed.success) {
    throw new GitHubReleaseError("GitHub returned release data in an unexpected format.");
  }

  return parsed.data
    .filter((release) => !release.draft && !release.prerelease)
    .map(mapRelease)
    .sort((a, b) => {
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    });
}

export function selectLatestStableRelease(releases: PublishedRelease[]) {
  return [...releases].sort((a, b) => {
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  })[0] ?? null;
}

async function fetchReleases(): Promise<PublishedRelease[]> {
  const { owner, repo } = getGitHubConfig();
  const { GITHUB_TOKEN } = getServerEnv();
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=100`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 300 },
    },
  );

  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new GitHubReleaseError("GitHub release rate limit reached. Try again shortly.");
    }
    if (response.status === 404) {
      throw new GitHubReleaseError("The configured GitHub releases repository was not found.");
    }
    throw new GitHubReleaseError("GitHub releases are temporarily unavailable.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GitHubReleaseError("GitHub returned an invalid release response.");
  }

  return parseGitHubReleases(payload);
}

export async function getAllReleases() {
  return fetchReleases();
}

export async function getLatestRelease() {
  return selectLatestStableRelease(await fetchReleases());
}

export async function getReleaseByVersion(version: string) {
  const releases = await fetchReleases();
  const normalized = version.trim().replace(/^v(?=\d)/i, "");
  return (
    releases.find(
      (release) =>
        release.tagName === version ||
        release.tagName.replace(/^v(?=\d)/i, "") === normalized,
    ) ?? null
  );
}
