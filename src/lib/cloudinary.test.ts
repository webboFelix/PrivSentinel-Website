import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteProfileAvatar, uploadProfileAvatar } from "./cloudinary";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Cloudinary profile images", () => {
  it("uploads to the profile_images folder using a non-identifying public ID", async () => {
    vi.stubEnv("CLOUDINARY_URL", "");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "test-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "test-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "test-secret");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      secure_url: "https://res.cloudinary.com/test-cloud/image/upload/v1/avatar.png",
    }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadProfileAvatar("user-1", Buffer.from("image"), "image/png");

    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    const digest = createHash("sha256").update("user-1").digest("hex");
    expect(body.get("public_id")).toBe(`privsentinel/profile_images/${digest}`);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
    );
  });

  it("uses CLOUDINARY_URL credentials for signed image uploads", async () => {
    vi.stubEnv("CLOUDINARY_URL", "cloudinary://test-key:test-secret@test-cloud");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    vi.stubEnv("CLOUDINARY_API_KEY", "");
    vi.stubEnv("CLOUDINARY_API_SECRET", "");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      secure_url: "https://res.cloudinary.com/test-cloud/image/upload/v1/avatar.png",
    }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadProfileAvatar("user-1", Buffer.from("image"), "image/png");

    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("api_key")).toBe("test-key");
    expect(body.get("signature")).toMatch(/^[a-f0-9]{40}$/);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
    );
  });

  it("includes the Cloudinary HTTP status in rejected upload errors", async () => {
    vi.stubEnv("CLOUDINARY_URL", "");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "test-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "test-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "test-secret");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ error: { message: "Invalid signature" } }, { status: 401 }),
    ));

    await expect(uploadProfileAvatar("user-1", Buffer.from("image"), "image/png"))
      .rejects.toThrow("Cloudinary upload failed with HTTP 401.");
  });

  it("deletes both the current and legacy avatar paths", async () => {
    vi.stubEnv("CLOUDINARY_URL", "");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "test-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "test-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "test-secret");
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ result: "not found" }))
      .mockResolvedValueOnce(Response.json({ result: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteProfileAvatar("user-1");

    const digest = createHash("sha256").update("user-1").digest("hex");
    const ids = fetchMock.mock.calls.map(([, init]) => (init?.body as FormData).get("public_id"));
    expect(ids).toEqual([
      `privsentinel/profile_images/${digest}`,
      `privsentinel/avatars/${digest}`,
    ]);
  });
});
