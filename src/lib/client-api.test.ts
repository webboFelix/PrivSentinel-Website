import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, requestJson } from "./client-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestJson", () => {
  it("parses successful JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ ok: true }),
    ));

    await expect(requestJson<{ ok: boolean }>("/api/example")).resolves.toEqual({ ok: true });
  });

  it("uses the API error message for failed responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({ error: "Please sign in." }, { status: 401 }),
    ));

    await expect(requestJson("/api/example")).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "Please sign in.",
      status: 401,
    });
  });

  it("returns a helpful error when the service returns a non-JSON failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("<html>Unavailable</html>", { status: 503 }),
    ));

    await expect(requestJson("/api/example")).rejects.toMatchObject({
      message: "The service is temporarily unavailable. Please try again shortly.",
      status: 503,
    });
  });

  it("converts network failures and timeouts into user-facing errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(requestJson("/api/example")).rejects.toMatchObject({
      message: "Unable to connect to the service. Check your connection and try again.",
      status: 0,
    });

    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    ));
    await expect(requestJson("/api/example", undefined, 1)).rejects.toBeInstanceOf(ApiRequestError);
    await expect(requestJson("/api/example", undefined, 1)).rejects.toMatchObject({
      message: "The request took too long. Check your connection and try again.",
      status: 408,
    });
  });
});
