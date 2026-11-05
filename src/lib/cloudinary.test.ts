import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteProfileAvatar, uploadProfileAvatar } from "./cloudinary";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Cloudinary profile images", () => {
  it("uploads to the profile_images folder using a non-identifying public ID", async () => {
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

  it("deletes both the current and legacy avatar paths", async () => {
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
