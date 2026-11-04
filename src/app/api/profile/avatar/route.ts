import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { auditLogs, profileDetails } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { enforceRateLimit, isSameOriginRequest } from "@/lib/rate-limit";


const avatarPattern = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const maxImageBytes = 5 * 1024 * 1024;
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
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Sign in to update your avatar." }, { status: 401 });
  if (!(await enforceRateLimit(request, `avatar:${session.user.id}`, 8, 900))) {
    return Response.json({ error: "Too many avatar updates. Try again later." }, { status: 429 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxRequestBytes) {
    return Response.json({ error: "Avatar images must be 5 MB or smaller." }, { status: 413 });
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
        return Response.json({ error: "Avatar images must be 5 MB or smaller." }, { status: 413 });
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
    await db.insert(profileDetails).values({
      userId: session.user.id,
      avatar: null,
    }).onConflictDoUpdate({
      target: profileDetails.userId,
      set: { avatar: null, updatedAt: new Date() },
    });
    await db.insert(auditLogs).values({
      id: randomUUID(),
      userId: session.user.id,
      action: "profile.avatar.removed",
      resource: "profile.avatar",
    });
    return Response.json({ image: null });
  }
  if (typeof image !== "string" || image.length > maxEncodedLength) {
    return Response.json({ error: "Avatar images must be 5 MB or smaller." }, { status: 413 });
  }
  const match = avatarPattern.exec(image);
  if (!match) {
    return Response.json({ error: "Use a PNG, JPEG, or WebP avatar image." }, { status: 400 });
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > maxImageBytes || !isSupportedImage(match[1], bytes)) {
    return Response.json({ error: "The image is invalid or exceeds the 5 MB limit." }, { status: 400 });
  }

  const db = getDb();
  await db.insert(profileDetails).values({
    userId: session.user.id,
    avatar: image,
  }).onConflictDoUpdate({
    target: profileDetails.userId,
    set: { avatar: image, updatedAt: new Date() },
  });
  await db.insert(auditLogs).values({
    id: randomUUID(),
    userId: session.user.id,
    action: "profile.avatar.updated",
    resource: "profile.avatar",
  });
  return Response.json({ image });
}
