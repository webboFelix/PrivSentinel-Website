import { describe, expect, it } from "vitest";
import { formatTimeAgo } from "./time-ago";

describe("formatTimeAgo", () => {
  const now = Date.parse("2026-11-05T12:00:00.000Z");

  it("formats past timestamps relatively", () => {
    expect(formatTimeAgo("2026-11-05T11:55:00.000Z", now)).toBe("5 minutes ago");
    expect(formatTimeAgo("2026-11-04T12:00:00.000Z", now)).toBe("yesterday");
  });

  it("formats future timestamps relatively", () => {
    expect(formatTimeAgo("2026-11-05T12:05:00.000Z", now)).toBe("in 5 minutes");
  });

  it("uses a clear fallback for invalid timestamps", () => {
    expect(formatTimeAgo("not-a-date", now)).toBe("Date not provided");
  });
});
