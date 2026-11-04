import { connection } from "next/server";
import { ensureDatabaseSchema } from "@/db";
import { getAuth } from "@/lib/auth";

export async function GET(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  await connection();
  await ensureDatabaseSchema();
  return getAuth().handler(request);
}
