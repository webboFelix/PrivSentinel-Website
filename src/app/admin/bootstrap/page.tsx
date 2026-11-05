import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminAccessDenied } from "@/components/admin-access-denied";
import { SuperAdminBootstrap } from "@/components/super-admin-bootstrap";
import { ensureDatabaseSchema, getLibsqlClient } from "@/db";
import { getPrincipal } from "@/lib/authorization";
import { getServerEnv } from "@/lib/env";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function BootstrapPage() {
  return <Suspense fallback={<main className="auth-page"><div className="account-loading"><span className="loading-dot" /> Loading secure setup…</div></main>}><BootstrapContent /></Suspense>;
}

async function BootstrapContent() {
  await connection();
  const principal = await getPrincipal(await headers());
  if (!principal) {
    return <AdminAccessDenied description="Sign in with the designated initial administrator account to access this page." />;
  }

  const designatedEmail = getServerEnv().INITIAL_SUPER_ADMIN_EMAIL;
  if (!designatedEmail || principal.actor.email.toLowerCase() !== designatedEmail) {
    return <AdminAccessDenied description="This setup page is restricted to the designated initial administrator account." />;
  }

  await ensureDatabaseSchema();
  const [bootstrap, superAdministrator] = await Promise.all([
    getLibsqlClient().execute({
      sql: `SELECT "completedAt" FROM "admin_bootstrap" WHERE "id" = 'initial-super-admin'`,
    }),
    getLibsqlClient().execute({
      sql: `SELECT "id" FROM "user" WHERE "role" = 'super_admin' LIMIT 1`,
    }),
  ]);
  const isInitialized = bootstrap.rows[0]?.completedAt != null || superAdministrator.rows.length > 0;

  return (
    <SuperAdminBootstrap
      email={principal.actor.email}
      emailVerified={principal.actor.emailVerified}
      isInitialized={isInitialized}
      isSuperAdministrator={principal.actor.role === "super_admin"}
    />
  );
}
