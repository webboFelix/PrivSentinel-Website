import { desc } from "drizzle-orm";
import { connection } from "next/server";
import { ensureDatabaseSchema, getDb } from "@/db";
import { contactMessages } from "@/db/schema";
import { isResponse, requireAdminApi } from "@/lib/admin-api";

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  const principal = await requireAdminApi(request);
  if (isResponse(principal)) return principal;

  const messages = await getDb().select().from(contactMessages)
    .orderBy(desc(contactMessages.createdAt))
    .limit(200);
  return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}
