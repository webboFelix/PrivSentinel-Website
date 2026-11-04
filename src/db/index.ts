import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getDatabaseConfig } from "@/lib/env";
import { schema } from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof createClient> | undefined;
let database: Database | undefined;
let schemaInitialization: Promise<void> | undefined;

export function getDb() {
  if (!database) {
    const config = getDatabaseConfig();
    client = createClient(config);
    database = drizzle(client, { schema });
  }
  return database;
}

export function getLibsqlClient() {
  if (!client) {
    const config = getDatabaseConfig();
    client = createClient(config);
  }
  return client;
}

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS "user" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "email" text NOT NULL,
    "emailVerified" integer DEFAULT 0 NOT NULL,
    "image" text,
    "role" text DEFAULT 'user' NOT NULL,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "session" (
    "id" text PRIMARY KEY NOT NULL,
    "expiresAt" integer NOT NULL,
    "token" text NOT NULL,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "account" (
    "id" text PRIMARY KEY NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" integer,
    "refreshTokenExpiresAt" integer,
    "scope" text,
    "password" text,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "verification" (
    "id" text PRIMARY KEY NOT NULL,
    "identifier" text NOT NULL,
    "value" text NOT NULL,
    "expiresAt" integer NOT NULL,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "profiles" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
    "fullName" text NOT NULL,
    "phoneNumber" text,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "profile_details" (
    "userId" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "gender" text,
    "organization" text,
    "currentPosition" text,
    "avatar" text,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "billing_customers" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
    "stripeCustomerId" text NOT NULL UNIQUE,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "payment_methods" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "brand" text NOT NULL,
    "last4" text NOT NULL,
    "expiryMonth" integer NOT NULL,
    "expiryYear" integer NOT NULL,
    "createdAt" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "releases" (
    "id" text PRIMARY KEY NOT NULL,
    "version" text NOT NULL,
    "tagName" text NOT NULL UNIQUE,
    "releaseName" text NOT NULL,
    "releaseNotes" text NOT NULL,
    "publishedAt" integer,
    "installerName" text,
    "installerUrl" text,
    "installerSize" integer,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "downloads" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "releaseId" text NOT NULL REFERENCES "releases"("id"),
    "assetName" text NOT NULL,
    "downloadedAt" integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text REFERENCES "user"("id") ON DELETE SET NULL,
    "action" text NOT NULL,
    "resource" text NOT NULL,
    "timestamp" integer NOT NULL,
    "metadata" text
  )`,
  `CREATE TABLE IF NOT EXISTS "rate_limits" (
    "key" text PRIMARY KEY NOT NULL,
    "windowStart" integer NOT NULL,
    "count" integer DEFAULT 0 NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "testimonials" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "location" text,
    "quote" text NOT NULL,
    "rating" integer NOT NULL,
    "approvedAt" integer,
    "createdAt" integer NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique" ON "session" ("token")`,
  `CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "payment_methods_userId_idx" ON "payment_methods" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier")`,
  `CREATE INDEX IF NOT EXISTS "releases_publishedAt_idx" ON "releases" ("publishedAt")`,
  `CREATE INDEX IF NOT EXISTS "downloads_userId_idx" ON "downloads" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "downloads_releaseId_idx" ON "downloads" ("releaseId")`,
  `CREATE INDEX IF NOT EXISTS "downloads_downloadedAt_idx" ON "downloads" ("downloadedAt")`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs" ("timestamp")`,
  `CREATE INDEX IF NOT EXISTS "testimonials_approvedAt_idx" ON "testimonials" ("approvedAt")`,
];

const additiveColumnMigrations = [
  {
    table: "profile_details",
    columns: [
      { name: "gender", definition: "text" },
      { name: "organization", definition: "text" },
      { name: "currentPosition", definition: "text" },
      { name: "avatar", definition: "text" },
      { name: "createdAt", definition: "integer" },
      { name: "updatedAt", definition: "integer" },
    ],
  },
] as const;

async function addMissingColumns() {
  const libsql = getLibsqlClient();
  for (const migration of additiveColumnMigrations) {
    const tableInfo = await libsql.execute(`PRAGMA table_info("${migration.table}")`);
    const existingColumns = new Set(tableInfo.rows.map((row) => String(row.name)));
    for (const column of migration.columns) {
      if (existingColumns.has(column.name)) continue;
      try {
        await libsql.execute(
          `ALTER TABLE "${migration.table}" ADD COLUMN "${column.name}" ${column.definition}`,
        );
      } catch (error) {
        const latestTableInfo = await libsql.execute(`PRAGMA table_info("${migration.table}")`);
        const latestColumns = new Set(latestTableInfo.rows.map((row) => String(row.name)));
        if (!latestColumns.has(column.name)) throw error;
      }
      existingColumns.add(column.name);
    }
  }
}

export function ensureDatabaseSchema(): Promise<void> {
  if (!schemaInitialization) {
    schemaInitialization = getLibsqlClient()
      .batch(schemaStatements, "write")
      .then(() => addMissingColumns())
      .catch((error: unknown) => {
        schemaInitialization = undefined;
        throw error;
      });
  }
  return schemaInitialization;
}
