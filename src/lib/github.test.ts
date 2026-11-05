import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllReleases, getWindowsInstaller, parseGitHubReleases, selectLatestStableRelease } from "./github";

afterEach(() => {
  vi.unstubAllGlobals();
});

function release(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    tag_name: "v1.0.0",
    name: "PrivSentinel 1.0.0",
    body: "Security updates",
    published_at: "2026-10-01T10:00:00Z",
    draft: false,
    prerelease: false,
    html_url: "https://github.com/CybersecurityHubVAPT/PrivSentinel-Releases/releases/tag/v1.0.0",
    assets: [
      {
        name: "PrivSentinel-setup-v1.0.0.exe",
        size: 12_500_000,
        browser_download_url: "https://github.com/CybersecurityHubVAPT/PrivSentinel-Releases/releases/download/v1.0.0/PrivSentinel-setup-v1.0.0.exe",
        download_count: 7,
      },
      {
        name: "PrivSentinel.zip",
        size: 2_000_000,
        browser_download_url: "https://github.com/CybersecurityHubVAPT/PrivSentinel-Releases/releases/download/v1.0.0/PrivSentinel.zip",
        download_count: 2,
      },
    ],
    ...overrides,
  };
}

describe("GitHub release parsing", () => {
  it("filters out draft and prerelease builds", () => {
    const releases = parseGitHubReleases([
      release(),
      release({ id: 13, tag_name: "v2.0.0-rc.1", prerelease: true }),
      release({ id: 14, tag_name: "v3.0.0", draft: true }),
    ]);
    expect(releases.map((item) => item.tagName)).toEqual(["v1.0.0"]);
  });

  it("selects only the Windows executable, not an archive", () => {
    const [item] = parseGitHubReleases([release()]);
    expect(getWindowsInstaller(item)?.name).toBe("PrivSentinel-setup-v1.0.0.exe");
    expect(item.installer?.downloadCount).toBe(7);
    expect(item.installer?.size).toBe(12_500_000);
  });

  it("selects the most recently published stable release dynamically", () => {
    const releases = parseGitHubReleases([
      release({ id: 1, tag_name: "v1.0.2", published_at: "2026-10-02T10:00:00Z" }),
      release({ id: 2, tag_name: "v1.0.3", published_at: "2026-10-03T10:00:00Z" }),
    ]);
    expect(selectLatestStableRelease(releases)?.tagName).toBe("v1.0.3");
  });

  it("handles releases without a publication timestamp and missing installers", () => {
    const releases = parseGitHubReleases([
      release({ id: 2, tag_name: "v2.0.0", published_at: null, assets: [] }),
      release({ id: 1, tag_name: "v1.0.0" }),
    ]);
    expect(releases[0]?.tagName).toBe("v1.0.0");
    expect(releases[1]?.installer).toBeNull();
    expect(selectLatestStableRelease(releases)?.tagName).toBe("v1.0.0");
  });

  it("converts upstream network failures into a clean release error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(getAllReleases()).rejects.toEqual(
      expect.objectContaining({
        name: "GitHubReleaseError",
        message: "Could not connect to GitHub. Check your connection and try again.",
      }),
    );

  });
});
