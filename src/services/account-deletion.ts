import { createHash } from "node:crypto";
import type { InStatement } from "@libsql/client";
import { eq } from "drizzle-orm";
import { getDb, getLibsqlClient, ensureDatabaseSchema } from "@/db";
import { billingCustomers, profileDetails } from "@/db/schema";
import { deleteProfileAvatar } from "@/lib/cloudinary";
import { getStripe } from "@/lib/stripe";

type AccountToDelete = { id: string; email: string };

export async function cleanAccountDataBeforeDeletion(account: AccountToDelete, request?: Request) {
  if (request?.headers.get("x-account-delete-confirmation") !== "DELETE") {
    throw new Error("Confirm account deletion before continuing.");
  }

  await ensureDatabaseSchema();
  const db = getDb();
  const [profile, billing] = await Promise.all([
    db.query.profileDetails.findFirst({
      columns: { avatar: true },
      where: eq(profileDetails.userId, account.id),
    }),
    db.query.billingCustomers.findFirst({
      columns: { stripeCustomerId: true },
      where: eq(billingCustomers.userId, account.id),
    }),
  ]);

  if (billing) {
    try {
      await getStripe().customers.del(billing.stripeCustomerId);
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "resource_missing")) {
        throw new Error("The billing profile could not be removed. Try again or contact support.", { cause: error });
      }
    }
  }

  if (profile?.avatar?.startsWith("https://res.cloudinary.com/")) {
    await deleteProfileAvatar(account.id);
  }

  const rateLimitScopes = [
    "avatar",
    "testimonial",
    "testimonial-edit",
    "testimonial-delete",
    "download",
    "billing-setup",
    "billing-confirm",
    "admin-user-update",
    "testimonial-moderation",
    "release-management",
  ];
  const subjectRateLimitScopes = ["email-verification", "super-admin-bootstrap"];
  const subjectHash = createHash("sha256").update(account.id).digest("hex");
  const transaction = await getLibsqlClient().transaction("write");
  try {
    const statements: InStatement[] = [
      {
        sql: `DELETE FROM "audit_logs"
        WHERE "userId" = ?
          OR ("targetType" = 'user' AND "targetId" = ?)
          OR ("targetType" = 'testimonial' AND "targetId" IN (
            SELECT "id" FROM "testimonials" WHERE "userId" = ?
          ))`,
        args: [account.id, account.id, account.id],
      },
      { sql: `DELETE FROM "testimonials" WHERE "userId" = ?`, args: [account.id] },
      {
        sql: `DELETE FROM "verification"
        WHERE lower("identifier") = lower(?) OR "value" = ?`,
        args: [account.email, account.id],
      },
      { sql: `DELETE FROM "account" WHERE "userId" = ?`, args: [account.id] },
      { sql: `DELETE FROM "session" WHERE "userId" = ?`, args: [account.id] },
      { sql: `DELETE FROM "downloads" WHERE "userId" = ?`, args: [account.id] },
      { sql: `DELETE FROM "payment_methods" WHERE "userId" = ?`, args: [account.id] },
      { sql: `DELETE FROM "billing_customers" WHERE "userId" = ?`, args: [account.id] },
      { sql: `DELETE FROM "profile_details" WHERE "userId" = ?`, args: [account.id] },
      { sql: `UPDATE "testimonials" SET "reviewedBy" = NULL WHERE "reviewedBy" = ?`, args: [account.id] },
      { sql: `UPDATE "release_overrides" SET "updatedBy" = NULL WHERE "updatedBy" = ?`, args: [account.id] },
      { sql: `UPDATE "admin_bootstrap" SET "completedBy" = NULL WHERE "completedBy" = ?`, args: [account.id] },
      { sql: `UPDATE "session" SET "impersonatedBy" = NULL WHERE "impersonatedBy" = ?`, args: [account.id] },
    ];
    for (const scope of rateLimitScopes) {
      const key = `${scope}:${account.id}:`;
      statements.push({
        sql: `DELETE FROM "rate_limits" WHERE substr("key", 1, ?) = ?`,
        args: [key.length, key],
      });
    }
    for (const scope of subjectRateLimitScopes) {
      statements.push({
        sql: `DELETE FROM "rate_limits" WHERE "key" = ?`,
        args: [`${scope}:${subjectHash}`],
      });
    }
    await transaction.batch(statements);
    await transaction.commit();
  } catch (error) {
    let cause: unknown = error;
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      cause = new AggregateError(
        [error, rollbackError],
        "Account cleanup failed and the database transaction could not be rolled back.",
      );
    } finally {
      transaction.close();
    }
    throw new Error("Personal account data could not be removed. Try again.", { cause });
  }
}
