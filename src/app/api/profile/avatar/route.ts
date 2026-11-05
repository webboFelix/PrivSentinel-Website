import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { auditLogs, profileDetails } from "@/db/schema";
import { getPrincipal } from "@/lib/authorization";
import { deleteProfileAvatar, uploadProfileAvatar } from "@/lib/cloudinary";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";


const avatarPattern = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const maxImageBytes = 1024 * 1024;
const maxEncodedLength = Math.ceil(maxImageBytes / 3) * 4 + 30;
const maxRequestBytes = maxEncodedLength + 1_000;

function isSupportedImage(mime: string, bytes: Buffer) {
  if (mime === "png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return mime === "webp" && bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP";
}

export async function POST(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const principal = await getPrincipal(request.headers);
  if (!principal) return Response.json({ error: "Sign in to update your avatar." }, { status: 401 });
  if (!(await enforceRateLimit(request, `avatar:${principal.actor.id}`, 8, 900))) {
    return Response.json({ error: "Too many avatar updates. Try again later." }, { status: 429 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) {
    return Response.json({ error: "Avatar images must be 1 MB or smaller." }, { status: 413 });
  }

  let body: unknown;
  try {
    if (!request.body) throw new Error("Missing body");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxRequestBytes) {
        await reader.cancel();
        return Response.json({ error: "Avatar images must be 1 MB or smaller." }, { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return Response.json({ error: "Provide a valid avatar image." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("image" in body)) {
    return Response.json({ error: "Provide a valid avatar image." }, { status: 400 });
  }

  const image = body.image;
  if (image === null) {
    const db = getDb();
    const current = await db.query.profileDetails.findFirst({
      columns: { avatar: true },
      where: eq(profileDetails.userId, principal.actor.id),
    });
    if (current?.avatar?.startsWith("https://res.cloudinary.com/")) {
      try {
        await deleteProfileAvatar(principal.actor.id);
      } catch {
        return Response.json({ error: "Profile image could not be removed from Cloudinary. Please try again." }, { status: 502 });
      }
    }
    await db.insert(profileDetails).values({
      userId: principal.actor.id,
      avatar: null,
    }).onConflictDoUpdate({
      target: profileDetails.userId,
      set: { avatar: null, updatedAt: new Date() },
    });
    await db.insert(auditLogs).values({
      id: randomUUID(),
      userId: principal.actor.id,
      action: "profile.avatar.removed",
      resource: "profile.avatar",
    });
    return Response.json({ image: null });
  }
  if (typeof image !== "string" || image.length > maxEncodedLength) {
    return Response.json({ error: "Avatar images must be 1 MB or smaller." }, { status: 413 });
  }
  const match = avatarPattern.exec(image);
  if (!match) {
    return Response.json({ error: "Use a PNG, JPEG, or WebP avatar image." }, { status: 400 });
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > maxImageBytes || !isSupportedImage(match[1], bytes)) {
    return Response.json({ error: "The image is invalid or exceeds the 1 MB limit." }, { status: 400 });
  }

  let imageUrl: string;
  try {
    imageUrl = await uploadProfileAvatar(principal.actor.id, bytes, `image/${match[1]}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Cloudinary is not configured.")) {
      return Response.json({ error: "Profile image storage is not configured. Please contact the site administrator." }, { status: 503 });
    }
    return Response.json({ error: "Profile image could not be uploaded. Please try again." }, { status: 502 });
  }

  const db = getDb();
  await db.insert(profileDetails).values({
    userId: principal.actor.id,
    avatar: imageUrl,
  }).onConflictDoUpdate({
    target: profileDetails.userId,
    set: { avatar: imageUrl, updatedAt: new Date() },
  });
  await db.insert(auditLogs).values({
    id: randomUUID(),
    userId: principal.actor.id,
    action: "profile.avatar.updated",
    resource: "profile.avatar",
  });
  return Response.json({ image: imageUrl });
}
