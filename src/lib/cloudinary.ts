import { createHash } from "node:crypto";
import { getCloudinaryConfig } from "@/lib/env";

function avatarPublicIds(userId: string) {
  const digest = createHash("sha256").update(userId).digest("hex");
  return [
    `privsentinel/profile_images/${digest}`,
    `privsentinel/avatars/${digest}`,
  ];
}

function signature(params: Record<string, string>, secret: string) {
  const canonical = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${canonical}${secret}`).digest("hex");
}

function cloudinaryEndpoint(cloudName: string, action: "upload" | "destroy") {
  return `https://api.cloudinary.com/v1_1/${cloudName}/image/${action}`;
}

export async function uploadProfileAvatar(userId: string, bytes: Buffer, mimeType: string) {
  const config = getCloudinaryConfig();
  const [publicId] = avatarPublicIds(userId);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = { overwrite: "true", public_id: publicId, timestamp };
  const body = new FormData();
  body.set("api_key", config.apiKey);
  body.set("overwrite", params.overwrite);
  body.set("public_id", publicId);
  body.set("timestamp", timestamp);
  body.set("signature", signature(params, config.apiSecret));
  body.set("file", new Blob([new Uint8Array(bytes)], { type: mimeType }), "avatar");

  const response = await fetch(cloudinaryEndpoint(config.cloudName, "upload"), {
    method: "POST",
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const result: unknown = await response.json();
  if (!response.ok || typeof result !== "object" || result === null || !("secure_url" in result) ||
      typeof result.secure_url !== "string" ||
      !result.secure_url.startsWith(`https://res.cloudinary.com/${config.cloudName}/image/upload/`)) {
    throw new Error("Cloudinary did not accept the profile image.");
  }
  return result.secure_url;
}

export async function deleteProfileAvatar(userId: string) {
  const config = getCloudinaryConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));
  for (const publicId of avatarPublicIds(userId)) {
    const params = { public_id: publicId, timestamp };
    const body = new FormData();
    body.set("api_key", config.apiKey);
    body.set("public_id", publicId);
    body.set("timestamp", timestamp);
    body.set("signature", signature(params, config.apiSecret));

    const response = await fetch(cloudinaryEndpoint(config.cloudName, "destroy"), {
      method: "POST",
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const result: unknown = await response.json();
    if (!response.ok || typeof result !== "object" || result === null ||
        !("result" in result) || !["ok", "not found"].includes(String(result.result))) {
      throw new Error("Cloudinary did not remove the profile image.");
    }
  }
}
