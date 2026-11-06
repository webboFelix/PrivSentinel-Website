import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminAccessDenied } from "@/components/admin-access-denied";
import { AdminDashboard } from "@/components/admin-dashboard";
import { DottedLoader } from "@/components/dotted-loader";
import { getPrincipal } from "@/lib/authorization";

export default function AdminPage() {
  return <Suspense fallback={<main className="admin-page"><div className="account-loading"><DottedLoader label="Loading secure administration…" /></div></main>}><AdminContent /></Suspense>;
}

async function AdminContent() {
  await connection();
  const principal = await getPrincipal(await headers(), true);
  if (!principal || (principal.actor.role !== "admin" && principal.actor.role !== "super_admin")) {
    return <AdminAccessDenied description="Sign in with an administrator account to access this page." />;
  }
  return <AdminDashboard role={principal.actor.role} currentUserId={principal.actor.id} />;
}
