import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getPrincipal } from "@/lib/authorization";

export default function AdminPage() {
  return <Suspense fallback={<main className="admin-page"><div className="account-loading"><span className="loading-dot" /> Loading secure administration…</div></main>}><AdminContent /></Suspense>;
}

async function AdminContent() {
  await connection();
  const principal = await getPrincipal(await headers());
  if (!principal) redirect("/login?next=%2Fadmin");
  if (principal.actor.role !== "admin" && principal.actor.role !== "super_admin") {
    redirect("/dashboard");
  }
  return <AdminDashboard role={principal.actor.role} currentUserId={principal.actor.id} />;
}
